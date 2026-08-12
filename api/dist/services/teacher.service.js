// Purpose: Teacher CRUD + multi-subject assignment + unassigned subjects.
import bcrypt from "bcryptjs";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertSchoolMatch, requireSchoolId } from "../lib/schoolScope.js";
export async function createTeacher(input, actor) {
    const schoolId = requireSchoolId(actor);
    const email = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                fullName: `${input.firstName} ${input.lastName}`,
                email,
                passwordHash,
                role: "TEACHER",
                schoolId,
            },
        });
        return tx.teacher.create({
            data: {
                schoolId,
                userId: user.id,
                firstName: input.firstName,
                lastName: input.lastName,
                email,
                phone: input.phone,
                department: input.department,
            },
            include: {
                user: { select: { id: true, fullName: true, email: true, role: true } },
                subjects: { include: { subject: true } },
            },
        });
    });
}
export async function updateTeacher(id, input, actor) {
    const teacher = assertFound(await prisma.teacher.findUnique({ where: { id } }), "Teacher not found");
    assertSchoolMatch(actor, teacher.schoolId, "Teacher");
    const email = input.email?.toLowerCase();
    const firstName = input.firstName ?? teacher.firstName;
    const lastName = input.lastName ?? teacher.lastName;
    return prisma.$transaction(async (tx) => {
        if (email || input.firstName || input.lastName) {
            await tx.user.update({
                where: { id: teacher.userId },
                data: {
                    ...(email ? { email } : {}),
                    fullName: `${firstName} ${lastName}`,
                },
            });
        }
        return tx.teacher.update({
            where: { id },
            data: {
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone === undefined ? undefined : input.phone,
                department: input.department,
                email,
            },
            include: {
                user: { select: { id: true, fullName: true, email: true, role: true } },
                subjects: { include: { subject: true } },
            },
        });
    });
}
export async function listTeachers(params, actor) {
    const schoolId = requireSchoolId(actor);
    const where = {
        schoolId,
        ...(params.q
            ? {
                OR: [
                    { firstName: { contains: params.q, mode: "insensitive" } },
                    { lastName: { contains: params.q, mode: "insensitive" } },
                    { email: { contains: params.q, mode: "insensitive" } },
                    { department: { contains: params.q, mode: "insensitive" } },
                ],
            }
            : {}),
    };
    const [total, data] = await Promise.all([
        prisma.teacher.count({ where }),
        prisma.teacher.findMany({
            where,
            skip: (params.page - 1) * params.limit,
            take: params.limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, fullName: true, role: true, mustChangePassword: true } },
                subjects: { include: { subject: true } },
            },
        }),
    ]);
    return {
        data: data.map((t) => ({
            ...t,
            avatarInitials: `${t.firstName[0] ?? ""}${t.lastName[0] ?? ""}`.toUpperCase(),
        })),
        meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
    };
}
export async function getTeacherById(id, actor) {
    const teacher = assertFound(await prisma.teacher.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, fullName: true, email: true, role: true } },
            subjects: { include: { subject: true } },
        },
    }), "Teacher not found");
    assertSchoolMatch(actor, teacher.schoolId, "Teacher");
    return {
        ...teacher,
        avatarInitials: `${teacher.firstName[0] ?? ""}${teacher.lastName[0] ?? ""}`.toUpperCase(),
    };
}
export async function assignTeacherToSubject(input, actor) {
    const schoolId = requireSchoolId(actor);
    const teacher = assertFound(await prisma.teacher.findUnique({ where: { id: input.teacherId } }), "Teacher not found");
    assertSchoolMatch(actor, teacher.schoolId, "Teacher");
    const subject = assertFound(await prisma.subject.findUnique({ where: { id: input.subjectId } }), "Subject not found");
    assertSchoolMatch(actor, subject.schoolId, "Subject");
    return prisma.$transaction(async (tx) => {
        // A subject belongs to a single teacher per session: drop any other holder first.
        await tx.teacherSubject.deleteMany({
            where: {
                subjectId: input.subjectId,
                session: input.session,
                teacherId: { not: input.teacherId },
                teacher: { schoolId },
            },
        });
        return tx.teacherSubject.upsert({
            where: {
                teacherId_subjectId_session: {
                    teacherId: input.teacherId,
                    subjectId: input.subjectId,
                    session: input.session,
                },
            },
            create: input,
            update: {},
            include: { teacher: true, subject: true },
        });
    });
}
export async function assignTeacherSubjects(input, actor) {
    const schoolId = requireSchoolId(actor);
    const teacher = assertFound(await prisma.teacher.findUnique({ where: { id: input.teacherId } }), "Teacher not found");
    assertSchoolMatch(actor, teacher.schoolId, "Teacher");
    const subjects = await prisma.subject.findMany({
        where: { id: { in: input.subjectIds }, schoolId },
    });
    if (subjects.length !== input.subjectIds.length) {
        throw new AppError(400, "One or more subjects were not found");
    }
    return prisma.$transaction(async (tx) => {
        // Reassign each subject exclusively to this teacher for the session.
        await tx.teacherSubject.deleteMany({
            where: {
                subjectId: { in: input.subjectIds },
                session: input.session,
                teacherId: { not: input.teacherId },
                teacher: { schoolId },
            },
        });
        const created = [];
        for (const subjectId of input.subjectIds) {
            created.push(await tx.teacherSubject.upsert({
                where: {
                    teacherId_subjectId_session: {
                        teacherId: input.teacherId,
                        subjectId,
                        session: input.session,
                    },
                },
                create: { teacherId: input.teacherId, subjectId, session: input.session },
                update: {},
                include: { subject: true },
            }));
        }
        return created;
    });
}
export async function removeTeacherSubject(assignmentId, actor) {
    const assignment = assertFound(await prisma.teacherSubject.findUnique({
        where: { id: assignmentId },
        include: { teacher: true },
    }), "Assignment not found");
    assertSchoolMatch(actor, assignment.teacher.schoolId, "Assignment");
    await prisma.teacherSubject.delete({ where: { id: assignmentId } });
    return { message: "Subject removed from teacher" };
}
/** Subjects with no teacher assignment for the given session. */
export async function listUnassignedSubjects(session, actor) {
    const schoolId = requireSchoolId(actor);
    const assigned = await prisma.teacherSubject.findMany({
        where: { session, subject: { schoolId } },
        select: { subjectId: true },
    });
    const assignedIds = [...new Set(assigned.map((a) => a.subjectId))];
    return prisma.subject.findMany({
        where: {
            schoolId,
            ...(assignedIds.length ? { id: { notIn: assignedIds } } : {}),
        },
        orderBy: [{ level: "asc" }, { code: "asc" }],
    });
}
export async function deleteTeacher(id, actor) {
    const teacher = assertFound(await prisma.teacher.findUnique({
        where: { id },
        include: { subjects: true, scores: true },
    }), "Teacher not found");
    assertSchoolMatch(actor, teacher.schoolId, "Teacher");
    if (teacher.scores.length > 0) {
        throw new AppError(400, "Cannot delete teacher who has entered scores. Reassign or keep the record for history.");
    }
    await prisma.$transaction(async (tx) => {
        await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
        await tx.user.delete({ where: { id: teacher.userId } });
    });
    return { message: "Teacher deleted" };
}
