// Purpose: Client-side stream filters for senior subjects (mirrors api/src/data/ssSubjects).
const CORE = ["ENG", "MTH", "CIV", "ICT"];
const SCIENCE = ["PHY", "CHM", "BIO", "GEO", "FUR", "AGR"];
const ARTS = ["LIT", "GOV", "HIS", "CRS", "IRS", "FRE", "YOR", "IGB", "HAU"];
const COMMERCIAL = ["ECO", "ACC", "COM", "BUS", "FIN", "MKT", "OFP", "STO"];

export function prefixesForDepartment(department: string): string[] {
  const d = department.trim().toLowerCase();
  if (d.startsWith("art")) return [...CORE, ...ARTS, "ECO"];
  if (d.startsWith("comm") || d.startsWith("bus")) return [...CORE, ...COMMERCIAL];
  return [...CORE, ...SCIENCE, "ECO"];
}

export function subjectMatchesDepartment(code: string, department: string): boolean {
  const prefix = code.replace(/S[123]$/i, "").toUpperCase();
  return prefixesForDepartment(department).includes(prefix);
}

export const STREAM_OPTIONS = ["Science", "Arts", "Commercial"] as const;
