// Purpose: Result review/approval, broadsheet, report cards, comments — uses existing calculateGrade totals.
import type { ScoreStatus, Term } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertSchoolMatch, requireSchoolId } from "../lib/schoolScope.js";
import type { AuthUser } from "../middleware/auth.js";
import { calculateGrade } from "../utils/grades.js";
import { PASS_AVERAGE } from "../utils/levels.js";

type SheetStatus = "PENDING" | "INCOMPLETE" | "REVIEW" | "APPROVED" | "PUBLISHED" | "RETURNED";

function sheetStatusFromScores(
  enrolled: number,
  statuses: ScoreStatus[]
): SheetStatus {
  if (enrolled === 0) return "PENDING";
  if (statuses.length === 0) return "PENDING";
  if (statuses.length < enrolled) return "INCOMPLETE";
  if (statuses.some((s) => s === "RETURNED")) return "RETURNED";
  if (statuses.every((s) => s === "PUBLISHED")) return "PUBLISHED";
  if (statuses.every((s) => s === "APPROVED" || s === "PUBLISHED")) return "APPROVED";
  if (statuses.every((s) => s === "SUBMITTED" || s === "APPROVED" || s === "PUBLISHED")) {
    return "REVIEW";
  }
  return "INCOMPLETE";
}

async function assertTeacherAssignment(
  teacherId: string,
  subjectId: string,
  session: string
) {
  const assignment = await prisma.teacherSubject.findFirst({
    where: { teacherId, subjectId, session },
  });
  if (!assignment) {
    throw new AppError(403, "You can only enter scores for subjects you teach in this session");
  }
}

export async function upsertScoreWithWorkflow(
  input: {
    enrollmentId: string;
    assessment: number;
    exam: number;
    asDraft?: boolean;
  },
  actor: AuthUser
) {
  requireSchoolId(actor);
  if (actor.role !== "TEACHER" || !actor.teacherId) {
    throw new AppError(403, "Only teachers can enter scores");
  }

  const enrollment = assertFound(
    await prisma.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { score: true, subject: true, student: true },
    }),
    "Enrollment not found"
  );
  assertSchoolMatch(actor, enrollment.student.schoolId, "Enrollment");
  await assertTeacherAssignment(actor.teacherId, enrollment.subjectId, enrollment.session);

  if (
    enrollment.score &&
    (enrollment.score.status === "APPROVED" || enrollment.score.status === "PUBLISHED")
  ) {
    throw new AppError(
      400,
      "This score is locked after approval/publish. Ask an admin to return it for correction."
    );
  }

  let gradeResult;
  try {
    gradeResult = calculateGrade(input.assessment, input.exam);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : "Invalid score");
  }

  const now = new Date();
  const status: ScoreStatus = input.asDraft ? "DRAFT" : "SUBMITTED";
  const data = {
    teacherId: actor.teacherId,
    assessment: input.assessment,
    exam: input.exam,
    total: gradeResult.total,
    grade: gradeResult.grade,
    remark: gradeResult.remark,
    status,
    returnNote: null as string | null,
    submittedAt: input.asDraft ? enrollment.score?.submittedAt ?? null : now,
  };

  const include = {
    enrollment: { include: { student: { include: { user: true } }, subject: true } },
    teacher: true,
  } as const;

  if (enrollment.score) {
    return prisma.score.update({
      where: { id: enrollment.score.id },
      data,
      include,
    });
  }

  return prisma.score.create({
    data: { enrollmentId: input.enrollmentId, ...data },
    include,
  });
}

export async function bulkUpsertScores(
  input: {
    scores: Array<{ enrollmentId: string; assessment: number; exam: number }>;
    asDraft?: boolean;
  },
  actor: AuthUser
) {
  requireSchoolId(actor);
  if (actor.role !== "TEACHER" || !actor.teacherId) {
    throw new AppError(403, "Only teachers can enter scores");
  }
  if (!input.scores.length) throw new AppError(400, "No scores provided");
  if (input.scores.length > 200) throw new AppError(400, "Too many scores in one request");

  const results = [];
  const errors: Array<{ enrollmentId: string; message: string }> = [];

  for (const row of input.scores) {
    try {
      const score = await upsertScoreWithWorkflow(
        { ...row, asDraft: input.asDraft },
        actor
      );
      results.push(score);
    } catch (err) {
      errors.push({
        enrollmentId: row.enrollmentId,
        message: err instanceof AppError ? err.message : "Save failed",
      });
    }
  }

  return {
    saved: results.length,
    failed: errors.length,
    errors,
    data: results,
    message:
      errors.length === 0
        ? `${results.length} score(s) saved`
        : `${results.length} saved, ${errors.length} failed`,
  };
}

export async function listResultSheets(
  params: {
    session: string;
    term: Term;
    classId?: string;
  },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
    throw new AppError(403, "Not allowed");
  }

  let teacherSubjectFilter: string[] | undefined;
  if (actor.role === "TEACHER") {
    if (!actor.teacherId) throw new AppError(403, "Teacher profile not found");
    const assignments = await prisma.teacherSubject.findMany({
      where: { teacherId: actor.teacherId, session: params.session },
      select: { subjectId: true },
    });
    if (assignments.length === 0) {
      return {
        session: params.session,
        term: params.term,
        counts: { pending: 0, incomplete: 0, review: 0, approved: 0, published: 0, returned: 0 },
        sheets: [],
      };
    }
    teacherSubjectFilter = assignments.map((a) => a.subjectId);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: params.session,
      term: params.term,
      student: {
        schoolId,
        ...(params.classId ? { classId: params.classId } : {}),
      },
      ...(teacherSubjectFilter ? { subjectId: { in: teacherSubjectFilter } } : {}),
    },
    include: {
      score: true,
      subject: true,
      student: { select: { classId: true, schoolClass: { select: { id: true, name: true } } } },
    },
  });

  type Acc = {
    classId: string;
    className: string;
    subjectId: string;
    subjectCode: string;
    subjectTitle: string;
    enrolled: number;
    scored: number;
    statuses: ScoreStatus[];
    missing: number;
  };

  const map = new Map<string, Acc>();
  for (const e of enrollments) {
    const classId = e.student.classId;
    const key = `${classId}:${e.subjectId}`;
    const row =
      map.get(key) ??
      ({
        classId,
        className: e.student.schoolClass?.name ?? "—",
        subjectId: e.subjectId,
        subjectCode: e.subject.code,
        subjectTitle: e.subject.title,
        enrolled: 0,
        scored: 0,
        statuses: [] as ScoreStatus[],
        missing: 0,
      } satisfies Acc);
    row.enrolled += 1;
    if (e.score) {
      row.scored += 1;
      row.statuses.push(e.score.status);
    } else {
      row.missing += 1;
    }
    map.set(key, row);
  }

  const sheets = [...map.values()]
    .map((r) => ({
      classId: r.classId,
      className: r.className,
      subjectId: r.subjectId,
      subjectCode: r.subjectCode,
      subjectTitle: r.subjectTitle,
      session: params.session,
      term: params.term,
      enrolled: r.enrolled,
      scored: r.scored,
      missing: r.missing,
      completionPercent:
        r.enrolled > 0 ? Number(((r.scored / r.enrolled) * 100).toFixed(1)) : 0,
      status: sheetStatusFromScores(r.enrolled, r.statuses),
    }))
    .sort((a, b) =>
      `${a.className}${a.subjectCode}`.localeCompare(`${b.className}${b.subjectCode}`)
    );

  const counts = {
    pending: sheets.filter((s) => s.status === "PENDING").length,
    incomplete: sheets.filter((s) => s.status === "INCOMPLETE").length,
    review: sheets.filter((s) => s.status === "REVIEW").length,
    approved: sheets.filter((s) => s.status === "APPROVED").length,
    published: sheets.filter((s) => s.status === "PUBLISHED").length,
    returned: sheets.filter((s) => s.status === "RETURNED").length,
  };

  return { session: params.session, term: params.term, counts, sheets };
}

async function loadSheetEnrollments(
  schoolId: string,
  input: { classId: string; subjectId: string; session: string; term: Term }
) {
  const schoolClass = assertFound(
    await prisma.schoolClass.findFirst({ where: { id: input.classId, schoolId } }),
    "Class not found"
  );
  const subject = assertFound(
    await prisma.subject.findFirst({ where: { id: input.subjectId, schoolId } }),
    "Subject not found"
  );

  const enrollments = await prisma.enrollment.findMany({
    where: {
      subjectId: input.subjectId,
      session: input.session,
      term: input.term,
      student: { schoolId, classId: input.classId },
    },
    include: {
      score: { include: { teacher: true } },
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      subject: true,
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  return { schoolClass, subject, enrollments };
}

export async function getSheetDetail(
  input: { classId: string; subjectId: string; session: string; term: Term },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
    throw new AppError(403, "Not allowed");
  }
  if (actor.role === "TEACHER" && actor.teacherId) {
    await assertTeacherAssignment(actor.teacherId, input.subjectId, input.session);
  }

  const { schoolClass, subject, enrollments } = await loadSheetEnrollments(schoolId, input);
  const statuses = enrollments.filter((e) => e.score).map((e) => e.score!.status);
  const status = sheetStatusFromScores(enrollments.length, statuses);

  return {
    classId: schoolClass.id,
    className: schoolClass.name,
    subjectId: subject.id,
    subjectCode: subject.code,
    subjectTitle: subject.title,
    session: input.session,
    term: input.term,
    status,
    enrolled: enrollments.length,
    scored: statuses.length,
    missing: enrollments.length - statuses.length,
    rows: enrollments.map((e) => ({
      enrollmentId: e.id,
      studentId: e.student.id,
      studentName: `${e.student.lastName}, ${e.student.firstName}`,
      admissionNumber: e.student.admissionNumber,
      assessment: e.score?.assessment ?? null,
      exam: e.score?.exam ?? null,
      total: e.score?.total ?? null,
      grade: e.score?.grade ?? null,
      remark: e.score?.remark ?? null,
      status: e.score?.status ?? null,
      returnNote: e.score?.returnNote ?? null,
      teacherName: e.score
        ? `${e.score.teacher.firstName} ${e.score.teacher.lastName}`
        : null,
    })),
  };
}

export async function transitionSheet(
  input: {
    classId: string;
    subjectId: string;
    session: string;
    term: Term;
    action: "approve" | "publish" | "return";
    returnNote?: string;
  },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  if (actor.role !== "ADMIN") throw new AppError(403, "Only school admins can manage result approval");

  const { schoolClass, subject, enrollments } = await loadSheetEnrollments(schoolId, input);
  const scored = enrollments.filter((e) => e.score);
  if (scored.length === 0) throw new AppError(400, "No scores to process for this sheet");

  const now = new Date();

  if (input.action === "return") {
    const note = input.returnNote?.trim();
    if (!note) throw new AppError(400, "Return note is required");
    await prisma.score.updateMany({
      where: { id: { in: scored.map((e) => e.score!.id) } },
      data: { status: "RETURNED", returnNote: note },
    });
    return {
      message: `Returned ${scored.length} score(s) for ${subject.code} · ${schoolClass.name}`,
      status: "RETURNED" as const,
    };
  }

  if (input.action === "approve") {
    const incomplete = enrollments.length - scored.length;
    if (incomplete > 0) {
      throw new AppError(400, `Cannot approve: ${incomplete} student(s) still missing scores`);
    }
    const blocked = scored.filter(
      (e) => e.score!.status !== "SUBMITTED" && e.score!.status !== "RETURNED" && e.score!.status !== "APPROVED"
    );
    // Allow re-approve of SUBMITTED/RETURNED; skip if already published
    const toApprove = scored.filter(
      (e) => e.score!.status === "SUBMITTED" || e.score!.status === "RETURNED" || e.score!.status === "DRAFT"
    );
    if (toApprove.length === 0 && scored.every((e) => e.score!.status === "APPROVED" || e.score!.status === "PUBLISHED")) {
      return { message: "Already approved or published", status: "APPROVED" as const };
    }
    if (blocked.some((e) => e.score!.status === "PUBLISHED") && toApprove.length === 0) {
      return { message: "Already published", status: "PUBLISHED" as const };
    }
    await prisma.score.updateMany({
      where: { id: { in: toApprove.map((e) => e.score!.id) } },
      data: { status: "APPROVED", approvedAt: now, returnNote: null },
    });
    return {
      message: `Approved ${toApprove.length} score(s) for ${subject.code} · ${schoolClass.name}`,
      status: "APPROVED" as const,
    };
  }

  // publish
  const incomplete = enrollments.length - scored.length;
  if (incomplete > 0) {
    throw new AppError(400, `Cannot publish: ${incomplete} student(s) still missing scores`);
  }
  const notReady = scored.filter(
    (e) => e.score!.status !== "APPROVED" && e.score!.status !== "PUBLISHED"
  );
  if (notReady.length > 0) {
    throw new AppError(400, "Approve all scores before publishing");
  }
  const toPublish = scored.filter((e) => e.score!.status === "APPROVED");
  await prisma.$transaction(async (tx) => {
    if (toPublish.length) {
      await tx.score.updateMany({
        where: { id: { in: toPublish.map((e) => e.score!.id) } },
        data: { status: "PUBLISHED", publishedAt: now },
      });
    }
  });

  try {
    const { createSystemAnnouncement } = await import("./announcement.service.js");
    await createSystemAnnouncement({
      schoolId,
      title: `Results published — ${subject.code} (${schoolClass.name})`,
      body: `${subject.title} results for ${paramsTermLabel(input.term)} ${input.session} are now available.`,
      audience: "CLASS",
      createdById: actor.id,
      targetClassId: schoolClass.id,
    });
  } catch {
    /* non-blocking */
  }

  return {
    message: `Published ${toPublish.length || scored.length} score(s) for ${subject.code} · ${schoolClass.name}`,
    status: "PUBLISHED" as const,
  };
}

function paramsTermLabel(term: Term) {
  return term === "FIRST" ? "First Term" : term === "SECOND" ? "Second Term" : "Third Term";
}

/** Class broadsheet using existing score totals (no second grading algorithm). */
export async function getBroadsheet(
  params: { session: string; term: Term; classId: string },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
    throw new AppError(403, "Not allowed");
  }

  const schoolClass = assertFound(
    await prisma.schoolClass.findFirst({
      where: { id: params.classId, schoolId },
      include: { school: { select: { name: true, code: true } } },
    }),
    "Class not found"
  );

  const students = await prisma.student.findMany({
    where: { schoolId, classId: params.classId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      academicStatus: true,
    },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: params.session,
      term: params.term,
      student: { schoolId, classId: params.classId },
    },
    include: { subject: true, score: true },
  });

  const subjectsMap = new Map<string, { id: string; code: string; title: string }>();
  for (const e of enrollments) {
    subjectsMap.set(e.subjectId, {
      id: e.subject.id,
      code: e.subject.code,
      title: e.subject.title,
    });
  }
  const subjects = [...subjectsMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  type Cell = {
    total: number | null;
    grade: string | null;
    status: ScoreStatus | null;
  };

  const rows = students.map((st) => {
    const cells: Record<string, Cell> = {};
    let sum = 0;
    let count = 0;
    let publishedCount = 0;
    let pendingCount = 0;
    for (const sub of subjects) {
      const en = enrollments.find((e) => e.studentId === st.id && e.subjectId === sub.id);
      const score = en?.score;
      cells[sub.id] = {
        total: score?.total ?? null,
        grade: score?.grade ?? null,
        status: score?.status ?? null,
      };
      if (score) {
        sum += score.total;
        count += 1;
        if (score.status === "PUBLISHED") publishedCount += 1;
        else pendingCount += 1;
      }
    }
    const average = count > 0 ? Number((sum / count).toFixed(2)) : null;
    const grade =
      average == null
        ? null
        : average >= 70
          ? "A"
          : average >= 60
            ? "B"
            : average >= 50
              ? "C"
              : average >= 45
                ? "D"
                : average >= 40
                  ? "E"
                  : "F";
    return {
      studentId: st.id,
      name: `${st.lastName}, ${st.firstName}`,
      admissionNumber: st.admissionNumber,
      academicStatus: st.academicStatus,
      cells,
      total: count > 0 ? Number(sum.toFixed(2)) : null,
      average,
      grade,
      scoredSubjects: count,
      publishedSubjects: publishedCount,
      unpublishedSubjects: pendingCount,
      position: 0 as number | null,
    };
  });

  const ranked = [...rows]
    .filter((r) => r.average != null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  let lastAvg: number | null = null;
  let lastPos = 0;
  ranked.forEach((r, idx) => {
    if (r.average !== lastAvg) {
      lastPos = idx + 1;
      lastAvg = r.average;
    }
    r.position = lastPos;
  });
  for (const r of rows) {
    if (r.average == null) r.position = null;
  }

  const sheetStatuses = subjects.map((sub) => {
    const forSub = enrollments.filter((e) => e.subjectId === sub.id);
    const statuses = forSub.filter((e) => e.score).map((e) => e.score!.status);
    return {
      subjectId: sub.id,
      status: sheetStatusFromScores(forSub.length, statuses),
    };
  });

  return {
    schoolName: schoolClass.school.name,
    schoolCode: schoolClass.school.code,
    classId: schoolClass.id,
    className: schoolClass.name,
    session: params.session,
    term: params.term,
    subjects,
    subjectStatuses: sheetStatuses,
    students: rows,
    passAverage: PASS_AVERAGE,
  };
}

export async function getReportCard(
  studentId: string,
  params: { session: string; term: Term },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  if (actor.role === "STUDENT" && actor.studentId !== studentId) {
    throw new AppError(403, "Students can only view their own results");
  }

  const student = assertFound(
    await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        schoolClass: true,
        school: { select: { name: true, code: true, address: true, phone: true, email: true } },
        user: { select: { fullName: true } },
      },
    }),
    "Student not found"
  );

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      session: params.session,
      term: params.term,
      student: { schoolId },
    },
    include: { subject: true, score: { include: { teacher: true } } },
    orderBy: { subject: { code: "asc" } },
  });

  const isStudent = actor.role === "STUDENT";
  const visible = enrollments.filter((e) => {
    if (!e.score) return true; // show awaiting
    if (isStudent) return e.score.status === "PUBLISHED";
    return true;
  });

  const scored = visible.filter((e) => e.score && (!isStudent || e.score.status === "PUBLISHED"));
  const publishedScored = enrollments.filter((e) => e.score?.status === "PUBLISHED");
  const averageSource = isStudent ? publishedScored : scored;
  const average =
    averageSource.length > 0
      ? Number(
          (
            averageSource.reduce((s, e) => s + (e.score?.total ?? 0), 0) / averageSource.length
          ).toFixed(2)
        )
      : null;

  // Position among classmates (same average formula as broadsheet / existing totals)
  const classmates = await prisma.student.findMany({
    where: { schoolId, classId: student.classId },
    select: { id: true },
  });
  const classEnrollments = await prisma.enrollment.findMany({
    where: {
      session: params.session,
      term: params.term,
      studentId: { in: classmates.map((c) => c.id) },
    },
    include: { score: true },
  });

  const avgByStudent = new Map<string, number>();
  for (const sid of classmates.map((c) => c.id)) {
    const rows = classEnrollments.filter((e) => e.studentId === sid);
    const usable = rows.filter((e) => {
      if (!e.score) return false;
      return isStudent ? e.score.status === "PUBLISHED" : true;
    });
    if (usable.length === 0) continue;
    avgByStudent.set(
      sid,
      Number((usable.reduce((s, e) => s + e.score!.total, 0) / usable.length).toFixed(2))
    );
  }
  const ranked = [...avgByStudent.entries()].sort((a, b) => b[1] - a[1]);
  let position: number | null = null;
  let lastAvg: number | null = null;
  let lastPos = 0;
  ranked.forEach(([sid, avg], idx) => {
    if (avg !== lastAvg) {
      lastPos = idx + 1;
      lastAvg = avg;
    }
    if (sid === studentId) position = lastPos;
  });

  const comment = await prisma.termReportComment.findUnique({
    where: {
      studentId_session_term: {
        studentId,
        session: params.session,
        term: params.term,
      },
    },
  });

  const promotionHint =
    params.term === "THIRD" && average != null
      ? average >= PASS_AVERAGE
        ? "Eligible for promotion (average ≥ 45%)"
        : "Below promotion average (45%) — may repeat"
      : null;

  return {
    school: {
      name: student.school.name,
      code: student.school.code,
      address: student.school.address,
      phone: student.school.phone,
      email: student.school.email,
    },
    student: {
      id: student.id,
      fullName: student.user.fullName,
      admissionNumber: student.admissionNumber,
      className: student.schoolClass.name,
      level: student.level,
      department: student.department,
      academicStatus: student.academicStatus,
      academicStatusLabel:
        student.academicStatus === "REPEATING"
          ? "Repeated"
          : student.academicStatus === "PROMOTED"
            ? "Promoted"
            : "Active",
    },
    session: params.session,
    term: params.term,
    subjects: visible.map((e) => {
      const hide = isStudent && e.score && e.score.status !== "PUBLISHED";
      return {
        code: e.subject.code,
        title: e.subject.title,
        assessment: hide ? null : e.score?.assessment ?? null,
        exam: hide ? null : e.score?.exam ?? null,
        total: hide ? null : e.score?.total ?? null,
        grade: hide ? null : e.score?.grade ?? null,
        remark: hide ? null : e.score?.remark ?? null,
        status: e.score?.status ?? null,
        resultStatus: !e.score || hide
          ? "AWAITING_RESULT"
          : e.score.status === "PUBLISHED"
            ? "PUBLISHED"
            : e.score.status,
        resultStatusLabel: !e.score || hide
          ? "Awaiting Result"
          : e.score.status === "PUBLISHED"
            ? "Published"
            : e.score.status === "APPROVED"
              ? "Approved"
              : e.score.status === "SUBMITTED"
                ? "Submitted"
                : e.score.status === "RETURNED"
                  ? "Returned"
                  : e.score.status === "DRAFT"
                    ? "Draft"
                    : "Graded",
      };
    }),
    summary: {
      enrolled: enrollments.length,
      graded: averageSource.length,
      awaiting: enrollments.length - averageSource.length,
      average: isStudent ? (publishedScored.length ? average : null) : average,
      position,
      passAverage: PASS_AVERAGE,
      promotionHint,
    },
    comments: {
      teacherComment: comment?.teacherComment ?? null,
      principalComment: comment?.principalComment ?? null,
    },
  };
}

export async function upsertTermComments(
  input: {
    studentId: string;
    session: string;
    term: Term;
    teacherComment?: string | null;
    principalComment?: string | null;
  },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  const student = assertFound(
    await prisma.student.findFirst({ where: { id: input.studentId, schoolId } }),
    "Student not found"
  );

  if (actor.role === "TEACHER") {
    if (!actor.teacherId) throw new AppError(403, "Teacher profile not found");
    // Teacher may only set teacherComment, and only if they teach this student this session
    const taught = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        session: input.session,
        term: input.term,
        subject: {
          teachers: { some: { teacherId: actor.teacherId, session: input.session } },
        },
      },
    });
    if (!taught) {
      throw new AppError(403, "You can only comment on students in subjects you teach");
    }
    if (input.principalComment !== undefined) {
      throw new AppError(403, "Teachers cannot set principal/admin comments");
    }
  } else if (actor.role !== "ADMIN") {
    throw new AppError(403, "Not allowed");
  }

  const data: {
    teacherComment?: string | null;
    principalComment?: string | null;
    updatedById: string;
  } = { updatedById: actor.id };

  if (input.teacherComment !== undefined) {
    data.teacherComment = input.teacherComment?.trim() || null;
  }
  if (input.principalComment !== undefined && actor.role === "ADMIN") {
    data.principalComment = input.principalComment?.trim() || null;
  }

  return prisma.termReportComment.upsert({
    where: {
      studentId_session_term: {
        studentId: input.studentId,
        session: input.session,
        term: input.term,
      },
    },
    create: {
      schoolId,
      studentId: input.studentId,
      session: input.session,
      term: input.term,
      teacherComment: data.teacherComment ?? null,
      principalComment: data.principalComment ?? null,
      updatedById: actor.id,
    },
    update: data,
  });
}

export { PASS_AVERAGE };
