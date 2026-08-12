// Purpose: Junior secondary (JSS1–JSS3) core subject pack.
export type JssSubjectSeedRow = {
  codePrefix: string;
  title: string;
  unit: number;
  semester: number;
};

export const JSS_CORE: JssSubjectSeedRow[] = [
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

export const JSS_LEVELS = [
  { level: "JSS1", tag: "J1" },
  { level: "JSS2", tag: "J2" },
  { level: "JSS3", tag: "J3" },
] as const;

export function buildJssSubjectRows() {
  const rows: Array<{
    code: string;
    title: string;
    unit: number;
    semester: number;
    level: string;
  }> = [];
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
