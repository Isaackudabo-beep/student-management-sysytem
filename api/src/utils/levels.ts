// Purpose: Class level progression helpers (JSS1→…→SS3).
const LEVEL_ORDER = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;

export type SchoolLevel = (typeof LEVEL_ORDER)[number];

export function normalizeLevel(level: string): string {
  return level.trim().toUpperCase();
}

export function nextLevel(level: string): string | null {
  const idx = LEVEL_ORDER.indexOf(normalizeLevel(level) as SchoolLevel);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

export function isTerminalLevel(level: string): boolean {
  return normalizeLevel(level) === "SS3";
}

export const PASS_AVERAGE = 45;
