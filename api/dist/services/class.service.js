import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
export async function createClass(input) {
    const level = input.level.toUpperCase();
    const arm = input.arm?.trim() ? input.arm.toUpperCase() : undefined;
    const name = input.name.trim().toUpperCase() || `${level}${arm ?? ""}`;
    const existing = await prisma.schoolClass.findUnique({ where: { name } });
    if (existing) {
        throw new AppError(409, `Class ${name} already exists`);
    }
    return prisma.schoolClass.create({
        data: { name, level, arm },
        include: { _count: { select: { students: true } } },
    });
}
export async function listClasses(params) {
    const where = {
        AND: [
            params.level ? { level: { equals: params.level, mode: "insensitive" } } : {},
            params.q
                ? {
                    OR: [
                        { name: { contains: params.q, mode: "insensitive" } },
                        { level: { contains: params.q, mode: "insensitive" } },
                        { arm: { contains: params.q, mode: "insensitive" } },
                    ],
                }
                : {},
        ],
    };
    const [total, data] = await Promise.all([
        prisma.schoolClass.count({ where }),
        prisma.schoolClass.findMany({
            where,
            skip: (params.page - 1) * params.limit,
            take: params.limit,
            orderBy: [{ level: "asc" }, { name: "asc" }],
            include: { _count: { select: { students: true } } },
        }),
    ]);
    return {
        data,
        meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
    };
}
export async function getClassById(id) {
    return assertFound(await prisma.schoolClass.findUnique({
        where: { id },
        include: { students: true, _count: { select: { students: true } } },
    }), "Class not found");
}
export async function updateClass(id, input) {
    await assertFound(await prisma.schoolClass.findUnique({ where: { id } }), "Class not found");
    return prisma.schoolClass.update({
        where: { id },
        data: {
            name: input.name?.toUpperCase(),
            level: input.level?.toUpperCase(),
            arm: input.arm?.toUpperCase(),
        },
    });
}
export async function deleteClass(id) {
    const schoolClass = assertFound(await prisma.schoolClass.findUnique({
        where: { id },
        include: { _count: { select: { students: true } } },
    }), "Class not found");
    if (schoolClass._count.students > 0) {
        throw new AppError(400, "Cannot delete a class that still has students");
    }
    await prisma.schoolClass.delete({ where: { id } });
    return { message: "Class deleted" };
}
