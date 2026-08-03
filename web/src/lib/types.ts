// Purpose: Shared TypeScript types mirroring API responses.
export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
  studentId?: string | null;
  teacherId?: string | null;
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
  schoolClass?: SchoolClass;
  user?: { id: string; fullName: string; mustChangePassword?: boolean };
  _count?: { enrollments: number };
};

export type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  department: string;
  userId?: string;
  user?: { id: string; mustChangePassword?: boolean };
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
};
