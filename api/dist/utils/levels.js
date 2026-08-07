// Purpose: Class level progression helpers (JSS1→…→SS3).
const LEVEL_ORDER = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
export function normalizeLevel(level) {
    return level.trim().toUpperCase();
}
export function nextLevel(level) {
    const idx = LEVEL_ORDER.indexOf(normalizeLevel(level));
    if (idx < 0 || idx >= LEVEL_ORDER.length - 1)
        return null;
    return LEVEL_ORDER[idx + 1];
}
export function isTerminalLevel(level) {
    return normalizeLevel(level) === "SS3";
}
export const PASS_AVERAGE = 45;
