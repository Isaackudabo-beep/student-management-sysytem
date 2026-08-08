// Purpose: Explicit Prisma selects that omit optional new columns when the DB is mid-migration.
import type { Prisma } from "@prisma/client";

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
} satisfies Prisma.StudentSelect;

export const studentSelectWithStatus = {
  ...studentBaseSelect,
  academicStatus: true,
} satisfies Prisma.StudentSelect;

/** Enrollment scalars without `term` — works before term column exists. */
export const enrollmentBaseSelect = {
  id: true,
  studentId: true,
  subjectId: true,
  session: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EnrollmentSelect;

export const enrollmentSelectWithTerm = {
  ...enrollmentBaseSelect,
  term: true,
} satisfies Prisma.EnrollmentSelect;

export function withAcademicStatus<T extends Record<string, unknown>>(row: T) {
  const status = (row as { academicStatus?: string }).academicStatus ?? "ACTIVE";
  return { ...row, academicStatus: status };
}

export function withTerm<T extends Record<string, unknown>>(row: T) {
  const term = (row as { term?: string }).term ?? "FIRST";
  return { ...row, term };
}

export function isSchemaMismatch(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "P2021" || e.code === "P2022" || e.code === "P2010") return true;
  const msg = e.message ?? "";
  return /does not exist|Unknown column|column .* does not exist|relation .* does not exist/i.test(msg);
}
