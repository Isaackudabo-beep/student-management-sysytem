/** Student scalars always present before academicStatus migration. */
export const studentBaseSelect = {
    id: true,
    userId: true,
    admissionNumber: true,
    matricNumber: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    gender: true,
    dateOfBirth: true,
    address: true,
    parentName: true,
    parentPhone: true,
    department: true,
    level: true,
    classId: true,
    createdAt: true,
    updatedAt: true,
};
export const studentSelectWithStatus = {
    ...studentBaseSelect,
    academicStatus: true,
};
/** Enrollment scalars without `term` — works before term column exists. */
export const enrollmentBaseSelect = {
    id: true,
    studentId: true,
    subjectId: true,
    session: true,
    createdAt: true,
    updatedAt: true,
};
export const enrollmentSelectWithTerm = {
    ...enrollmentBaseSelect,
    term: true,
};
export function withAcademicStatus(row) {
    const status = row.academicStatus ?? "ACTIVE";
    return { ...row, academicStatus: status };
}
export function withTerm(row) {
    const term = row.term ?? "FIRST";
    return { ...row, term };
}
export function isSchemaMismatch(err) {
    if (!err || typeof err !== "object")
        return false;
    const e = err;
    if (e.code === "P2021" || e.code === "P2022" || e.code === "P2010")
        return true;
    const msg = e.message ?? "";
    return /does not exist|Unknown column|column .* does not exist|relation .* does not exist/i.test(msg);
}
