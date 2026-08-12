// Purpose: Ensure every school has SS Arts & Commercial (and Science/core) subject packs.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEVELS = [
  { level: "SS1", tag: "S1" },
  { level: "SS2", tag: "S2" },
  { level: "SS3", tag: "S3" },
];

const PACKS = [
  { codePrefix: "ENG", title: "English Language", unit: 3, semester: 1 },
  { codePrefix: "MTH", title: "Mathematics", unit: 3, semester: 1 },
  { codePrefix: "CIV", title: "Civic Education", unit: 2, semester: 1 },
  { codePrefix: "ICT", title: "Computer Studies", unit: 2, semester: 1 },
  { codePrefix: "PHY", title: "Physics", unit: 3, semester: 1 },
  { codePrefix: "CHM", title: "Chemistry", unit: 3, semester: 1 },
  { codePrefix: "BIO", title: "Biology", unit: 3, semester: 1 },
  { codePrefix: "GEO", title: "Geography", unit: 2, semester: 1 },
  { codePrefix: "FUR", title: "Further Mathematics", unit: 3, semester: 1 },
  { codePrefix: "AGR", title: "Agricultural Science", unit: 2, semester: 1 },
  { codePrefix: "LIT", title: "Literature in English", unit: 3, semester: 1 },
  { codePrefix: "GOV", title: "Government", unit: 3, semester: 1 },
  { codePrefix: "HIS", title: "History", unit: 2, semester: 1 },
  { codePrefix: "CRS", title: "Christian Religious Studies", unit: 2, semester: 1 },
  { codePrefix: "IRS", title: "Islamic Religious Studies", unit: 2, semester: 1 },
  { codePrefix: "FRE", title: "French", unit: 2, semester: 1 },
  { codePrefix: "YOR", title: "Yoruba Language", unit: 2, semester: 1 },
  { codePrefix: "IGB", title: "Igbo Language", unit: 2, semester: 1 },
  { codePrefix: "HAU", title: "Hausa Language", unit: 2, semester: 1 },
  { codePrefix: "ECO", title: "Economics", unit: 3, semester: 1 },
  { codePrefix: "ACC", title: "Financial Accounting", unit: 3, semester: 1 },
  { codePrefix: "COM", title: "Commerce", unit: 3, semester: 1 },
  { codePrefix: "BUS", title: "Business Studies", unit: 2, semester: 1 },
  { codePrefix: "FIN", title: "Insurance", unit: 2, semester: 1 },
  { codePrefix: "MKT", title: "Marketing", unit: 2, semester: 1 },
  { codePrefix: "OFP", title: "Office Practice", unit: 2, semester: 1 },
  { codePrefix: "STO", title: "Store Management", unit: 2, semester: 1 },
];

function buildRows() {
  const rows = [];
  for (const { level, tag } of LEVELS) {
    for (const s of PACKS) {
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
    let created = 0;
    for (const row of rows) {
      const existing = await prisma.subject.findUnique({
        where: { schoolId_code: { schoolId: school.id, code: row.code } },
      });
      if (existing) continue;
      await prisma.subject.create({
        data: {
          schoolId: school.id,
          code: row.code,
          title: row.title,
          unit: row.unit,
          semester: row.semester,
          level: row.level,
        },
      });
      created += 1;
    }
    totalCreated += created;
    console.log(`${school.code}: +${created} senior subjects`);
  }

  console.log(`Done. Schools=${schools.length}, subjects created=${totalCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
