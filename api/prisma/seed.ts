// Purpose: Seed secondary-school demo data — classes, subjects, roles, announcements.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildJssSubjectRows } from "../src/data/jssSubjects.js";
import { buildSsSubjectRows } from "../src/data/ssSubjects.js";
import { DEFAULT_CLASSES } from "../src/lib/defaultClasses.js";
import { calculateGrade } from "../src/utils/grades.js";

const prisma = new PrismaClient();
const SESSION = "2025/2026";

async function main() {
  // Clear in dependency order (RESTRICT FKs require children first).
  await prisma.announcementRead.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.score.deleteMany();
  await prisma.resultArchive.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.user.deleteMany();

  const school =
    (await prisma.school.findFirst({ where: { code: "DEFAULT" } })) ||
    (await prisma.school.create({
      data: {
        id: "school_default_legacy",
        name: "Default School",
        code: "DEFAULT",
        status: "ACTIVE",
      },
    }));

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.create({
    data: {
      fullName: "System Admin",
      email: "admin@sms.local",
      passwordHash,
      role: "ADMIN",
      schoolId: school.id,
    },
  });

  const classes = await Promise.all(
    DEFAULT_CLASSES.map((c) => prisma.schoolClass.create({ data: { ...c, schoolId: school.id } }))
  );

  const ss2Class = classes.find((c) => c.name === "SS2A")!;

  const teacherUser = await prisma.user.create({
    data: {
      fullName: "Jane Teacher",
      email: "teacher@sms.local",
      passwordHash,
      role: "TEACHER",
      schoolId: school.id,
      teacher: {
        create: {
          firstName: "Jane",
          lastName: "Teacher",
          email: "teacher@sms.local",
          phone: "08011112222",
          department: "Sciences",
          schoolId: school.id,
        },
      },
    },
    include: { teacher: true },
  });

  const allSubjectRows = [
    ...buildJssSubjectRows(),
    ...buildSsSubjectRows().map(({ pack: _pack, ...row }) => row),
  ];

  const createdSubjects = [];
  for (const row of allSubjectRows) {
    createdSubjects.push(await prisma.subject.create({ data: { ...row, schoolId: school.id } }));
  }

  const ss2Subjects = createdSubjects.filter((s) => s.level === "SS2");

  for (const subject of ss2Subjects.slice(0, 6)) {
    await prisma.teacherSubject.create({
      data: {
        teacherId: teacherUser.teacher!.id,
        subjectId: subject.id,
        session: SESSION,
      },
    });
  }

  const selectedSubjects = ss2Subjects.slice(0, 6);

  const studentUser = await prisma.user.create({
    data: {
      fullName: "John Student",
      email: "student@sms.local",
      passwordHash,
      role: "STUDENT",
      mustChangePassword: false,
      schoolId: school.id,
      student: {
        create: {
          admissionNumber: "ADM/SS2/001",
          matricNumber: "ADM/SS2/001",
          firstName: "John",
          lastName: "Student",
          email: "student@sms.local",
          phone: "08033334444",
          gender: "MALE",
          dateOfBirth: new Date("2009-05-14"),
          address: "12 School Road, Lagos",
          parentName: "Mary Student",
          parentPhone: "08055556666",
          department: "Science",
          level: "SS2",
          classId: ss2Class.id,
          schoolId: school.id,
        },
      },
    },
    include: { student: true },
  });

  for (const subject of selectedSubjects) {
    await prisma.enrollment.create({
      data: {
        studentId: studentUser.student!.id,
        subjectId: subject.id,
        session: SESSION,
        term: "FIRST",
      },
    });
  }

  const firstEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentUser.student!.id, subjectId: selectedSubjects[0].id },
  });

  if (firstEnrollment) {
    const grade = calculateGrade(32, 48);
    await prisma.score.create({
      data: {
        enrollmentId: firstEnrollment.id,
        teacherId: teacherUser.teacher!.id,
        assessment: 32,
        exam: 48,
        total: grade.total,
        grade: grade.grade,
        remark: grade.remark,
      },
    });
  }

  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id,
        title: "Results for Second Term are now available",
        body: "Students can view graded subjects on their dashboard. Subjects without scores still show Awaiting Result.",
        audience: "ALL",
        createdById: admin.id,
      },
      {
        schoolId: school.id,
        title: "School resumes on September 15",
        body: "All students and teachers should report for the new academic session on September 15.",
        audience: "ALL",
        createdById: admin.id,
      },
      {
        schoolId: school.id,
        title: "Exam timetable has been released",
        body: "Check the notice board and your dashboard for the SS2 exam timetable.",
        audience: "STUDENTS",
        createdById: admin.id,
      },
      {
        schoolId: school.id,
        title: "Score entry deadline",
        body: "Teachers should complete continuous assessment and exam scores before Friday.",
        audience: "TEACHERS",
        createdById: admin.id,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Admin:   admin@sms.local / Password123!");
  console.log("Teacher: teacher@sms.local / Password123!");
  console.log("Student: student@sms.local / Password123!");
  console.log(`Session: ${SESSION}`);
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
