// Purpose: Two-school tenant isolation test — identical names/emails must not leak.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PASSWORD = "Password123!";
const SHARED_EMAIL = "twin.student@example.com";
const SHARED_ADM = "ADM/SS1/001";
const SHARED_NAME = { firstName: "Ada", lastName: "Okeke" };

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function seedSchool(code, name) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const school =
    (await prisma.school.findUnique({ where: { code } })) ||
    (await prisma.school.create({
      data: { name, code, status: "ACTIVE" },
    }));

  const oldStudents = await prisma.student.findMany({
    where: { schoolId: school.id, email: SHARED_EMAIL },
    select: { id: true, userId: true },
  });
  for (const s of oldStudents) {
    await prisma.enrollment.deleteMany({ where: { studentId: s.id } });
    await prisma.resultArchive.deleteMany({ where: { studentId: s.id } });
    await prisma.student.delete({ where: { id: s.id } });
    await prisma.user.delete({ where: { id: s.userId } }).catch(() => undefined);
  }
  await prisma.user.deleteMany({
    where: { schoolId: school.id, email: `admin.${code.toLowerCase()}@example.com` },
  });

  await prisma.user.create({
    data: {
      fullName: `${name} Admin`,
      email: `admin.${code.toLowerCase()}@example.com`,
      passwordHash,
      role: "ADMIN",
      schoolId: school.id,
      mustChangePassword: false,
    },
  });

  const klass =
    (await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: "SS1A" } })) ||
    (await prisma.schoolClass.create({
      data: { schoolId: school.id, name: "SS1A", level: "SS1", arm: "A" },
    }));

  const subjects = [];
  for (const row of [
    { code: "ENGS1", title: "English Language" },
    { code: "MTHS1", title: "Mathematics" },
    { code: "CIVS1", title: "Civic Education" },
    { code: "ICTS1", title: "Computer Studies" },
    { code: "PHYS1", title: "Physics" },
  ]) {
    const sub =
      (await prisma.subject.findUnique({
        where: { schoolId_code: { schoolId: school.id, code: row.code } },
      })) ||
      (await prisma.subject.create({
        data: {
          schoolId: school.id,
          code: row.code,
          title: row.title,
          unit: 3,
          semester: 1,
          level: "SS1",
        },
      }));
    subjects.push(sub);
  }

  const user = await prisma.user.create({
    data: {
      fullName: `${SHARED_NAME.firstName} ${SHARED_NAME.lastName}`,
      email: SHARED_EMAIL,
      passwordHash,
      role: "STUDENT",
      schoolId: school.id,
      mustChangePassword: false,
    },
  });

  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      userId: user.id,
      admissionNumber: SHARED_ADM,
      matricNumber: SHARED_ADM,
      firstName: SHARED_NAME.firstName,
      lastName: SHARED_NAME.lastName,
      email: SHARED_EMAIL,
      phone: "08000000000",
      gender: "FEMALE",
      dateOfBirth: new Date("2009-01-01"),
      address: `${name} address`,
      parentName: "Parent",
      parentPhone: "08011111111",
      department: "Science",
      level: "SS1",
      classId: klass.id,
    },
  });

  await prisma.enrollment.createMany({
    data: subjects.map((s) => ({
      studentId: student.id,
      subjectId: s.id,
      session: "2025/2026",
      term: "FIRST",
    })),
  });

  return { school, student, user, subjects };
}

async function main() {
  console.log("Seeding School Alpha & School Beta with identical student email/admission…");
  const alpha = await seedSchool("ALPHA", "Alpha Secondary School");
  const beta = await seedSchool("BETA", "Beta Secondary School");

  assert(alpha.student.email === beta.student.email, "emails should match");
  assert(alpha.student.admissionNumber === beta.student.admissionNumber, "admission numbers should match");
  assert(alpha.student.id !== beta.student.id, "student ids must differ");
  assert(alpha.school.id !== beta.school.id, "school ids must differ");

  const users = await prisma.user.findMany({ where: { email: SHARED_EMAIL } });
  assert(users.length === 2, `expected 2 users with ${SHARED_EMAIL}, got ${users.length}`);

  const alphaList = await prisma.student.findMany({ where: { schoolId: alpha.school.id } });
  assert(
    !alphaList.some((s) => s.id === beta.student.id),
    "beta student must not appear in alpha list"
  );

  const leak = await prisma.student.findFirst({
    where: { id: beta.student.id, schoolId: alpha.school.id },
  });
  assert(!leak, "alpha schoolId filter must not resolve beta student id");

  const alphaEnrollments = await prisma.enrollment.findMany({
    where: { studentId: alpha.student.id, student: { schoolId: alpha.school.id } },
    include: { subject: true },
  });
  assert(alphaEnrollments.length >= 5, "alpha enrollments present");
  assert(
    alphaEnrollments.every((e) => e.subject.schoolId === alpha.school.id),
    "enrollment subjects must belong to alpha"
  );

  const betaSubjectIds = new Set(beta.subjects.map((s) => s.id));
  assert(
    !alphaEnrollments.some((e) => betaSubjectIds.has(e.subjectId)),
    "alpha enrollments must not reference beta subjects"
  );

  const ambiguous = await prisma.user.findMany({
    where: { email: SHARED_EMAIL, role: "STUDENT" },
  });
  assert(ambiguous.length === 2, "login must see two candidates without school code");

  const alphaLogin = await prisma.user.findMany({
    where: {
      email: SHARED_EMAIL,
      role: "STUDENT",
      school: { code: { equals: "ALPHA", mode: "insensitive" } },
    },
  });
  assert(alphaLogin.length === 1 && alphaLogin[0].id === alpha.user.id, "ALPHA login scopes correctly");

  const betaLogin = await prisma.user.findMany({
    where: {
      email: SHARED_EMAIL,
      role: "STUDENT",
      school: { code: { equals: "BETA", mode: "insensitive" } },
    },
  });
  assert(betaLogin.length === 1 && betaLogin[0].id === beta.user.id, "BETA login scopes correctly");

  console.log("PASS: two-school isolation verified (identical email + admission number).");
  console.log(`  Alpha student=${alpha.student.id} school=${alpha.school.code}`);
  console.log(`  Beta student=${beta.student.id} school=${beta.school.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
