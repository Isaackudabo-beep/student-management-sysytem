// Purpose: Ensure every school has JSS1A → SS3A default classes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CLASSES = [
  { name: "JSS1A", level: "JSS1", arm: "A" },
  { name: "JSS2A", level: "JSS2", arm: "A" },
  { name: "JSS3A", level: "JSS3", arm: "A" },
  { name: "SS1A", level: "SS1", arm: "A" },
  { name: "SS2A", level: "SS2", arm: "A" },
  { name: "SS3A", level: "SS3", arm: "A" },
];

async function ensureForSchool(schoolId) {
  let created = 0;
  for (const row of DEFAULT_CLASSES) {
    const existing = await prisma.schoolClass.findUnique({
      where: { schoolId_name: { schoolId, name: row.name } },
    });
    if (existing) continue;
    await prisma.schoolClass.create({
      data: { schoolId, name: row.name, level: row.level, arm: row.arm },
    });
    created += 1;
  }
  return created;
}

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true, code: true } });
  let totalCreated = 0;

  for (const school of schools) {
    const created = await ensureForSchool(school.id);
    totalCreated += created;
    if (created > 0) {
      console.log(`ensure-default-classes: ${school.code} (+${created})`);
    }
  }

  console.log(`ensure-default-classes: done (${totalCreated} class(es) added across ${schools.length} school(s))`);
}

main()
  .catch((err) => {
    console.error("ensure-default-classes failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
