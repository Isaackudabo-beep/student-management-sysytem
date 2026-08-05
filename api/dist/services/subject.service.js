import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
export async function createSubject(input) {
    return prisma.subject.create({
        data: {
            ...input,
            code: input.code.toUpperCase(),
            level: input.level.toUpperCase(),
        },
    });
}
export async function listSubjects(params) {
    const where = {
        AND: [
            params.level ? { level: { equals: params.level, mode: "insensitive" } } : {},
            params.q
                ? {
                    OR: [
                        { code: { contains: params.q, mode: "insensitive" } },
                        { title: { contains: params.q, mode: "insensitive" } },
                    ],
                }
                : {},
        ],
    };
    const [total, data] = await Promise.all([
        prisma.subject.count({ where }),
        prisma.subject.findMany({
            where,
            skip: (params.page - 1) * params.limit,
            take: params.limit,
            orderBy: { code: "asc" },
            include: {
                teachers: { include: { teacher: true } },
                _count: { select: { enrollments: true } },
            },
        }),
    ]);
    return {
        data,
        meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
    };
}
export async function getSubjectById(id) {
    return assertFound(await prisma.subject.findUnique({
        where: { id },
        include: {
            teachers: { include: { teacher: true } },
            enrollments: { include: { student: true, score: true } },
        },
    }), "Subject not found");
}
export async function updateSubject(id, input) {
    await assertFound(await prisma.subject.findUnique({ where: { id } }), "Subject not found");
    return prisma.subject.update({
        where: { id },
        data: {
            ...input,
            code: input.code ? input.code.toUpperCase() : undefined,
            level: input.level ? input.level.toUpperCase() : undefined,
        },
    });
}
export async function deleteSubject(id) {
    const subject = assertFound(await prisma.subject.findUnique({
        where: { id },
        include: {
            enrollments: { include: { score: true } },
            teachers: true,
        },
    }), "Subject not found");
    const hasScores = subject.enrollments.some((e) => e.score);
    if (hasScores) {
        throw new AppError(400, "A subject with existing scores cannot be deleted until those scores are removed.");
    }
    if (subject.enrollments.length > 0 || subject.teachers.length > 0) {
        throw new AppError(400, "Cannot delete subject with enrollments or teacher assignments. Remove related records first.");
    }
    await prisma.subject.delete({ where: { id } });
    return { message: "Subject deleted" };
}
