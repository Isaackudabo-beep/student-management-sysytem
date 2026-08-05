// Purpose: Teacher CRUD + subject assignment (TeacherSubject).
import bcrypt from "bcryptjs";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
export async function createTeacher(input) {
    const email = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                fullName: `${input.firstName} ${input.lastName}`,
                email,
                passwordHash,
                role: "TEACHER",
            },
        });
        return tx.teacher.create({
            data: {
                userId: user.id,
                firstName: input.firstName,
                lastName: input.lastName,
                email,
                phone: input.phone,
                department: input.department,
            },
            include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
        });
    });
}
export async function listTeachers(params) {
    const where = params.q
        ? {
            OR: [
                { firstName: { contains: params.q, mode: "insensitive" } },
                { lastName: { contains: params.q, mode: "insensitive" } },
                { email: { contains: params.q, mode: "insensitive" } },
                { department: { contains: params.q, mode: "insensitive" } },
            ],
        }
        : {};
    const [total, data] = await Promise.all([
        prisma.teacher.count({ where }),
        prisma.teacher.findMany({
            where,
            skip: (params.page - 1) * params.limit,
            take: params.limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, fullName: true, role: true } },
                subjects: { include: { subject: true } },
            },
        }),
    ]);
    return {
        data,
        meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) },
    };
}
export async function getTeacherById(id) {
    return assertFound(await prisma.teacher.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, fullName: true, email: true, role: true } },
            subjects: { include: { subject: true } },
        },
    }), "Teacher not found");
}
export async function assignTeacherToSubject(input) {
    await assertFound(await prisma.teacher.findUnique({ where: { id: input.teacherId } }), "Teacher not found");
    await assertFound(await prisma.subject.findUnique({ where: { id: input.subjectId } }), "Subject not found");
    return prisma.teacherSubject.create({
        data: input,
        include: { teacher: true, subject: true },
    });
}
export async function deleteTeacher(id) {
    const teacher = assertFound(await prisma.teacher.findUnique({
        where: { id },
        include: { subjects: true, scores: true },
    }), "Teacher not found");
    if (teacher.subjects.length > 0 || teacher.scores.length > 0) {
        throw new AppError(400, "Cannot delete teacher with subject assignments or entered scores. Remove related records first.");
    }
    await prisma.user.delete({ where: { id: teacher.userId } });
    return { message: "Teacher deleted" };
}
