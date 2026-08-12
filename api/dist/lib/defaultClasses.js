import { prisma } from "./prisma.js";
export const DEFAULT_CLASSES = [
    { name: "JSS1A", level: "JSS1", arm: "A" },
    { name: "JSS2A", level: "JSS2", arm: "A" },
    { name: "JSS3A", level: "JSS3", arm: "A" },
    { name: "SS1A", level: "SS1", arm: "A" },
    { name: "SS2A", level: "SS2", arm: "A" },
    { name: "SS3A", level: "SS3", arm: "A" },
];
export async function ensureDefaultClassesForSchool(schoolId, db = prisma) {
    let created = 0;
    for (const row of DEFAULT_CLASSES) {
        const existing = await db.schoolClass.findUnique({
            where: { schoolId_name: { schoolId, name: row.name } },
        });
        if (existing)
            continue;
        await db.schoolClass.create({
            data: { schoolId, name: row.name, level: row.level, arm: row.arm },
        });
        created += 1;
    }
    return created;
}
