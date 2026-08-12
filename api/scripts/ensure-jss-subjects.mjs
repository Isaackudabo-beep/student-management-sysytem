// Purpose: Ensure every school has JSS1–JSS3 basic junior subjects.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JSS_CORE = [
  { codePrefix: "ENG", title: "English Language", unit: 3, semester: 1 },
  { codePrefix: "MTH", title: "Mathematics", unit: 3, semester: 1 },
  { codePrefix: "BSC", title: "Basic Science", unit: 3, semester: 1 },
  { codePrefix: "BST", title: "Basic Technology", unit: 2, semester: 1 },
  { codePrefix: "FRE", title: "French", unit: 2, semester: 1 },
  { codePrefix: "CIV", title: "Civic Education", unit: 2, semester: 1 },
  { codePrefix: "SOS", title: "Social Studies", unit: 2, semester: 1 },
  { codePrefix: "BUS", title: "Business Studies", unit: 2, semester: 1 },
  { codePrefix: "ICT", title: "Computer Studies", unit: 2, semester: 1 },
  { codePrefix: "CCA", title: "Cultural and Creative Arts", unit: 2, semester: 1 },
  { codePrefix: "PHE", title: "Physical and Health Education", unit: 2, semester: 1 },
  { codePrefix: "HEC", title: "Home Economics", unit: 2, semester: 1 },
  { codePrefix: "AGR", title: "Agricultural Science", unit: 2, semester: 1 },
  { codePrefix: "CRS", title: "Christian Religious Studies", unit: 2, semester: 1 },
  { codePrefix: "IRS", title: "Islamic Religious Studies", unit: 2, semester: 1 },
];

const JSS_LEVELS = [
  { level: "JSS1", tag: "J1" },
  { level: "JSS2", tag: "J2" },
  { level: "JSS3", tag: "J3" },
];

function buildRows() {
  const rows = [];
  for (const { level, tag } of JSS_LEVELS) {
    for (const s of JSS_CORE) {
      rows.push({
        code: `${s.codePrefix}${tag}`,
        title: s.title,
        unit: s.unit,
        semester: s.semester,
        level,
      });
    }
  }
  return rows;
}

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true, code: true } });
  const rows = buildRows();
  let totalCreated = 0;

  for (const school of schools) {
    const existing = await prisma.subject.findMany({
      where: { schoolId: school.id, code: { in: rows.map((r) => r.code) } },
      select: { code: true },
    });
    const have = new Set(existing.map((e) => e.code));
    const missing = rows
      .filter((r) => !have.has(r.code))
      .map((r) => ({ schoolId: school.id, ...r }));

    if (missing.length === 0) {
      console.log(`ensure-jss-subjects: ${school.code} (ok)`);
      continue;
    }

    const result = await prisma.subject.createMany({
      data: missing,
      skipDuplicates: true,
    });
    totalCreated += result.count;
    console.log(`ensure-jss-subjects: ${school.code} (+${result.count})`);
  }

  console.log(
    `ensure-jss-subjects: done (${totalCreated} subject(s) added across ${schools.length} school(s))`
  );
}

main()
  .catch((err) => {
    console.error("ensure-jss-subjects failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
