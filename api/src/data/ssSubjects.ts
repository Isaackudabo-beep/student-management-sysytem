// Purpose: Senior secondary subject packs by stream (Science / Arts / Commercial).
export type StreamPack = "CORE" | "SCIENCE" | "ARTS" | "COMMERCIAL";

export type SubjectSeedRow = {
  codePrefix: string;
  title: string;
  unit: number;
  semester: number;
  pack: StreamPack;
};

/** Shared SS subjects offered across streams. */
export const SS_CORE: SubjectSeedRow[] = [
  { codePrefix: "ENG", title: "English Language", unit: 3, semester: 1, pack: "CORE" },
  { codePrefix: "MTH", title: "Mathematics", unit: 3, semester: 1, pack: "CORE" },
  { codePrefix: "CIV", title: "Civic Education", unit: 2, semester: 1, pack: "CORE" },
  { codePrefix: "ICT", title: "Computer Studies", unit: 2, semester: 1, pack: "CORE" },
];

export const SS_SCIENCE: SubjectSeedRow[] = [
  { codePrefix: "PHY", title: "Physics", unit: 3, semester: 1, pack: "SCIENCE" },
  { codePrefix: "CHM", title: "Chemistry", unit: 3, semester: 1, pack: "SCIENCE" },
  { codePrefix: "BIO", title: "Biology", unit: 3, semester: 1, pack: "SCIENCE" },
  { codePrefix: "GEO", title: "Geography", unit: 2, semester: 1, pack: "SCIENCE" },
  { codePrefix: "FUR", title: "Further Mathematics", unit: 3, semester: 1, pack: "SCIENCE" },
  { codePrefix: "AGR", title: "Agricultural Science", unit: 2, semester: 1, pack: "SCIENCE" },
];

export const SS_ARTS: SubjectSeedRow[] = [
  { codePrefix: "LIT", title: "Literature in English", unit: 3, semester: 1, pack: "ARTS" },
  { codePrefix: "GOV", title: "Government", unit: 3, semester: 1, pack: "ARTS" },
  { codePrefix: "HIS", title: "History", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "CRS", title: "Christian Religious Studies", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "IRS", title: "Islamic Religious Studies", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "FRE", title: "French", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "YOR", title: "Yoruba Language", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "IGB", title: "Igbo Language", unit: 2, semester: 1, pack: "ARTS" },
  { codePrefix: "HAU", title: "Hausa Language", unit: 2, semester: 1, pack: "ARTS" },
];

export const SS_COMMERCIAL: SubjectSeedRow[] = [
  { codePrefix: "ECO", title: "Economics", unit: 3, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "ACC", title: "Financial Accounting", unit: 3, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "COM", title: "Commerce", unit: 3, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "BUS", title: "Business Studies", unit: 2, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "FIN", title: "Insurance", unit: 2, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "MKT", title: "Marketing", unit: 2, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "OFP", title: "Office Practice", unit: 2, semester: 1, pack: "COMMERCIAL" },
  { codePrefix: "STO", title: "Store Management", unit: 2, semester: 1, pack: "COMMERCIAL" },
];

export const SS_LEVELS = [
  { level: "SS1", tag: "S1" },
  { level: "SS2", tag: "S2" },
  { level: "SS3", tag: "S3" },
] as const;

export const ALL_SS_PACKS: SubjectSeedRow[] = [
  ...SS_CORE,
  ...SS_SCIENCE,
  ...SS_ARTS,
  ...SS_COMMERCIAL,
];

export function buildSsSubjectRows() {
  const rows: Array<{
    code: string;
    title: string;
    unit: number;
    semester: number;
    level: string;
    pack: StreamPack;
  }> = [];
  for (const { level, tag } of SS_LEVELS) {
    for (const s of ALL_SS_PACKS) {
      rows.push({
        code: `${s.codePrefix}${tag}`,
        title: s.title,
        unit: s.unit,
        semester: s.semester,
        level,
        pack: s.pack,
      });
    }
  }
  return rows;
}

/** Code prefixes allowed when filtering subjects for a student stream. */
export function prefixesForDepartment(department: string): string[] {
  const d = department.trim().toLowerCase();
  const core = SS_CORE.map((s) => s.codePrefix);
  if (d.startsWith("art")) {
    return [...core, ...SS_ARTS.map((s) => s.codePrefix), "ECO"];
  }
  if (d.startsWith("comm") || d.startsWith("bus")) {
    return [...core, ...SS_COMMERCIAL.map((s) => s.codePrefix)];
  }
  // Science / General default
  return [...core, ...SS_SCIENCE.map((s) => s.codePrefix), "ECO"];
}

export function subjectMatchesDepartment(code: string, department: string): boolean {
  const prefix = code.replace(/S[123]$/i, "").toUpperCase();
  return prefixesForDepartment(department).includes(prefix);
}
