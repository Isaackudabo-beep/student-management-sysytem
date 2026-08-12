// Purpose: Shared TypeScript types mirroring API responses.
export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
export type Term = "FIRST" | "SECOND" | "THIRD";
export type AcademicStatus = "ACTIVE" | "PROMOTED" | "REPEATING";
export type SchoolStatus = "ACTIVE" | "SUSPENDED";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  studentId?: string | null;
  teacherId?: string | null;
};

export type PlatformSchool = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: SchoolStatus;
  createdAt: string;
  adminCount?: number;
  _count?: {
    students: number;
    teachers: number;
    classes: number;
    subjects: number;
    users?: number;
    announcements?: number;
  };
  admins?: Array<{
    id: string;
    fullName: string;
    email: string;
    mustChangePassword: boolean;
    createdAt: string;
  }>;
};

export type SchoolClass = {
  id: string;
  name: string;
  level: string;
  arm?: string | null;
  _count?: { students: number };
};

export type Student = {
  id: string;
  admissionNumber: string;
  matricNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth?: string;
  address: string;
  parentName: string;
  parentPhone: string;
  department: string;
  level: string;
  classId: string;
  academicStatus?: AcademicStatus;
  academicStatusLabel?: string;
  classDisplay?: string;
  schoolClass?: SchoolClass;
  user?: { id: string; fullName: string; mustChangePassword?: boolean };
  enrollments?: Array<{
    id: string;
    session: string;
    term?: Term;
    subject: Subject;
    score?: Score | null;
  }>;
  archivedResults?: Array<{
    id: string;
    session: string;
    term: Term;
    subjectCode: string;
    subjectTitle: string;
    className: string;
    total: number;
    grade: string;
    remark: string;
  }>;
  _count?: { enrollments: number };
};

export type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  department: string;
  avatarInitials?: string;
  userId?: string;
  user?: { id: string; mustChangePassword?: boolean; fullName?: string };
  subjects?: Array<{
    id: string;
    session: string;
    subject: Subject;
  }>;
};

export type Subject = {
  id: string;
  code: string;
  title: string;
  unit: number;
  semester: number;
  level: string;
};

export type Enrollment = {
  id: string;
  session: string;
  term?: Term;
  student: Student;
  subject: Subject;
  score?: Score | null;
  resultStatus?: string;
  resultStatusLabel?: string;
};

export type Score = {
  id: string;
  assessment: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  enrollment?: Enrollment;
  teacher?: Teacher;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  expiresAt?: string | null;
  read?: boolean;
  createdBy?: string;
  targetClass?: string | null;
  targetUser?: string | null;
};
