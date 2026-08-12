// Purpose: Enforce school tenancy — every school actor must stay inside their schoolId.
import { AppError } from "./errors.js";
/** School workspace APIs — SUPER_ADMIN must use /api/platform instead. */
export function requireSchoolId(actor) {
    if (actor.role === "SUPER_ADMIN") {
        throw new AppError(403, "Platform super admins cannot use school workspace APIs");
    }
    if (!actor.schoolId) {
        throw new AppError(403, "Your account is not linked to a school");
    }
    return actor.schoolId;
}
export function assertSchoolMatch(actor, resourceSchoolId, label = "Record") {
    const schoolId = requireSchoolId(actor);
    if (!resourceSchoolId || resourceSchoolId !== schoolId) {
        throw new AppError(404, `${label} not found`);
    }
}
/** Prefer school-scoped id lookups so cross-tenant ids never resolve. */
export function schoolIdFilter(actor) {
    return { schoolId: requireSchoolId(actor) };
}
