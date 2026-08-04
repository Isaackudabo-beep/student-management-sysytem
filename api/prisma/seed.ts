// Purpose: Seed secondary-school demo data — classes, subjects, roles, announcements.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { calculateGrade } from "../src/utils/grades.js";

const prisma = new PrismaClient();
const SESSION = "2025/2026";

async function main() {
  // Clear in dependency order (RESTRICT FKs require children first).
  await prisma.announcementRead.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.score.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.create({
    data: {
      fullName: "System Admin",
      email: "admin@sms.local",
      passwordHash,
      role: "ADMIN",
    },
  });

  const classes = await Promise.all(
    [
      { name: "JSS1A", level: "JSS1", arm: "A" },
      { name: "JSS2A", level: "JSS2", arm: "A" },
      { name: "JSS3A", level: "JSS3", arm: "A" },
      { name: "SS1A", level: "SS1", arm: "A" },
      { name: "SS2B", level: "SS2", arm: "B" },
      { name: "SS3A", level: "SS3", arm: "A" },
    ].map((c) => prisma.schoolClass.create({ data: c }))
  );

  const ss2Class = classes.find((c) => c.name === "SS2B")!;

  const teacherUser = await prisma.user.create({
    data: {
      fullName: "Jane Teacher",
      email: "teacher@sms.local",
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          firstName: "Jane",
          lastName: "Teacher",
          email: "teacher@sms.local",
          phone: "08011112222",
          department: "Sciences",
        },
      },
    },
    include: { teacher: true },
  });

  const jssCore = (level: string, tag: string) => [
    { code: `ENG${tag}`, title: "English Language", unit: 3, semester: 1, level },
    { code: `MTH${tag}`, title: "Mathematics", unit: 3, semester: 1, level },
    { code: `BSC${tag}`, title: "Basic Science", unit: 3, semester: 1, level },
    { code: `BST${tag}`, title: "Basic Technology", unit: 2, semester: 1, level },
    { code: `CCA${tag}`, title: "Creative Arts", unit: 2, semester: 1, level },
    { code: `PHE${tag}`, title: "Physical Education", unit: 2, semester: 1, level },
  ];

  const ssCore = (level: string, tag: string) => [
    { code: `ENG${tag}`, title: "English Language", unit: 3, semester: 1, level },
    { code: `MTH${tag}`, title: "Mathematics", unit: 3, semester: 1, level },
    { code: `PHY${tag}`, title: "Physics", unit: 3, semester: 1, level },
    { code: `CHM${tag}`, title: "Chemistry", unit: 3, semester: 1, level },
    { code: `BIO${tag}`, title: "Biology", unit: 3, semester: 1, level },
    { code: `CIV${tag}`, title: "Civic Education", unit: 2, semester: 1, level },
    { code: `ECO${tag}`, title: "Economics", unit: 2, semester: 1, level },
    { code: `ICT${tag}`, title: "Computer Studies", unit: 2, semester: 1, level },
  ];

  const allSubjectRows = [
    ...jssCore("JSS1", "J1"),
    ...jssCore("JSS2", "J2"),
    ...jssCore("JSS3", "J3"),
    ...ssCore("SS1", "S1"),
    ...ssCore("SS2", "S2"),
    ...ssCore("SS3", "S3"),
  ];

  const createdSubjects = [];
  for (const row of allSubjectRows) {
    createdSubjects.push(await prisma.subject.create({ data: row }));
  }

  const ss2Subjects = createdSubjects.filter((s) => s.level === "SS2");

  for (const subject of ss2Subjects.slice(0, 6)) {
    await prisma.teacherSubject.create({
      data: {
        teacherId: teacherUser.teacher!.id,
        subjectId: subject.id,
        session: SESSION,
      },
    });
  }

  const selectedSubjects = ss2Subjects.slice(0, 6);

  const studentUser = await prisma.user.create({
    data: {
      fullName: "John Student",
      email: "student@sms.local",
      passwordHash,
      role: "STUDENT",
      mustChangePassword: false,
      student: {
        create: {
          admissionNumber: "ADM/SS2/001",
          matricNumber: "ADM/SS2/001",
          firstName: "John",
          lastName: "Student",
          email: "student@sms.local",
          phone: "08033334444",
          gender: "MALE",
          dateOfBirth: new Date("2009-05-14"),
          address: "12 School Road, Lagos",
          parentName: "Mary Student",
          parentPhone: "08055556666",
          department: "Science",
          level: "SS2",
          classId: ss2Class.id,
        },
      },
    },
    include: { student: true },
  });

  for (const subject of selectedSubjects) {
    await prisma.enrollment.create({
      data: {
        studentId: studentUser.student!.id,
        subjectId: subject.id,
        session: SESSION,
      },
    });
  }

  const firstEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentUser.student!.id, subjectId: selectedSubjects[0].id },
  });

  if (firstEnrollment) {
    const grade = calculateGrade(32, 48);
    await prisma.score.create({
      data: {
        enrollmentId: firstEnrollment.id,
        teacherId: teacherUser.teacher!.id,
        assessment: 32,
        exam: 48,
        total: grade.total,
        grade: grade.grade,
        remark: grade.remark,
      },
    });
  }

  await prisma.announcement.createMany({
    data: [
      {
        title: "Results for Second Term are now available",
        body: "Students can view graded subjects on their dashboard. Subjects without scores still show Awaiting Result.",
        audience: "ALL",
        createdById: admin.id,
      },
      {
        title: "School resumes on September 15",
        body: "All students and teachers should report for the new academic session on September 15.",
        audience: "ALL",
        createdById: admin.id,
      },
      {
        title: "Exam timetable has been released",
        body: "Check the notice board and your dashboard for the SS2 exam timetable.",
        audience: "STUDENTS",
        createdById: admin.id,
      },
      {
        title: "Score entry deadline",
        body: "Teachers should complete continuous assessment and exam scores before Friday.",
        audience: "TEACHERS",
        createdById: admin.id,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Admin:   admin@sms.local / Password123!");
  console.log("Teacher: teacher@sms.local / Password123!");
  console.log("Student: student@sms.local / Password123!");
  console.log(`Session: ${SESSION}`);
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
