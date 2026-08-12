// Purpose: Client-side stream filters for senior subjects (mirrors api/src/data/ssSubjects).
const CORE = ["ENG", "MTH", "CIV", "ICT"];
const SCIENCE = ["PHY", "CHM", "BIO", "GEO", "FUR", "AGR"];
const ARTS = ["LIT", "GOV", "HIS", "CRS", "IRS", "FRE", "YOR", "IGB", "HAU"];
const COMMERCIAL = ["ECO", "ACC", "COM", "BUS", "FIN", "MKT", "OFP", "STO"];

/** Junior = all subjects for JSS; senior streams filter SS packs. */
export const STREAM_OPTIONS = ["Junior", "Science", "Arts", "Commercial"] as const;

export function isJuniorDepartment(department: string) {
  const d = department.trim().toLowerCase();
  return d.startsWith("jun") || d.startsWith("gen") || d === "all";
}

export function isSeniorLevel(level: string) {
  return /^SS/i.test(level.trim());
}

export function prefixesForDepartment(department: string): string[] | null {
  const d = department.trim().toLowerCase();
  if (isJuniorDepartment(department)) return null; // null = all subjects
  if (d.startsWith("art")) return [...CORE, ...ARTS, "ECO"];
  if (d.startsWith("comm") || d.startsWith("bus")) return [...CORE, ...COMMERCIAL];
  return [...CORE, ...SCIENCE, "ECO"];
}

export function subjectMatchesDepartment(code: string, department: string): boolean {
  const prefixes = prefixesForDepartment(department);
  if (!prefixes) return true;
  const prefix = code.replace(/(S|J)[123]$/i, "").toUpperCase();
  return prefixes.includes(prefix);
}

/** Suggested department when a class level is chosen. */
export function departmentForLevel(level: string): string {
  return isSeniorLevel(level) ? "Science" : "Junior";
}
