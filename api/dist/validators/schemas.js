// Purpose: Shared Zod schemas for request validation across routes.
import { z } from "zod";
const phoneSchema = z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number");
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    expectedRole: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(6).optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
export const adminResetPasswordSchema = z.object({
    userId: z.string().min(1),
    temporaryPassword: z.string().min(8),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
export const createSchoolClassSchema = z.object({
    name: z.string().min(2).max(20),
    level: z.string().min(2).max(10),
    arm: z.string().max(5).optional(),
});
export const updateSchoolClassSchema = createSchoolClassSchema.partial();
export const createStudentSchema = z.object({
    fullName: z.string().min(2).optional(),
    email: z.string().email(),
    password: z.string().min(6),
    admissionNumber: z.string().min(3),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: phoneSchema,
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    dateOfBirth: z.string().min(4),
    address: z.string().min(5),
    parentName: z.string().min(2),
    parentPhone: phoneSchema,
    department: z.string().min(1).default("General"),
    classId: z.string().min(1),
    session: z.string().min(4),
    subjectIds: z.array(z.string().min(1)).min(5).max(11),
});
export const updateStudentSchema = z.object({
    fullName: z.string().min(2).optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: phoneSchema.optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().min(5).optional(),
    parentName: z.string().min(2).optional(),
    parentPhone: phoneSchema.optional(),
    department: z.string().min(1).optional(),
    classId: z.string().min(1).optional(),
});
export const createTeacherSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    department: z.string().min(1),
});
export const createSubjectSchema = z.object({
    code: z.string().min(2).max(20),
    title: z.string().min(2),
    unit: z.coerce.number().int().min(1).max(10),
    semester: z.coerce.number().int().min(1).max(3),
    level: z.string().min(2).max(10),
});
export const updateSubjectSchema = createSubjectSchema.partial();
export const assignTeacherSchema = z.object({
    teacherId: z.string().min(1),
    subjectId: z.string().min(1),
    session: z.string().min(4),
});
export const createEnrollmentSchema = z.object({
    studentId: z.string().min(1),
    subjectId: z.string().min(1),
    session: z.string().min(4),
});
export const upsertScoreSchema = z.object({
    enrollmentId: z.string().min(1),
    assessment: z.coerce.number().min(0).max(40),
    exam: z.coerce.number().min(0).max(60),
});
export const createAnnouncementSchema = z.object({
    title: z.string().min(3).max(120),
    body: z.string().min(5).max(2000),
    audience: z.enum(["ALL", "STUDENTS", "TEACHERS", "ADMINS"]),
    expiresAt: z.string().optional().nullable(),
});
export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export const searchQuerySchema = z.object({
    q: z.string().optional(),
    department: z.string().optional(),
    level: z.string().optional(),
    classId: z.string().optional(),
    session: z.string().optional(),
    studentId: z.string().optional(),
    subjectId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
