# Domain model — secondary school SMS

## Auth identity
- User: id, fullName, email (unique), passwordHash, role (ADMIN|TEACHER|STUDENT), mustChangePassword
- PasswordResetToken: reserved for future email-based reset (SMTP/Resend)

## Profiles
- Student.userId → User (unique)
- Teacher.userId → User (unique)
- Student fields: admissionNumber, gender, dateOfBirth, phone, address, parentName, parentPhone, classId, level, department (stream)

## School structure
- SchoolClass: name (JSS1A, SS2B…), level (JSS1, SS2…), arm?
- Subject: code, title, unit, semester/term, level (matches SchoolClass.level)

## Academic
- TeacherSubject: teacherId + subjectId + session (unique)
- Enrollment: studentId + subjectId + session (unique); 5–11 subjects per student registration
- Score: enrollmentId (unique), teacherId, assessment, exam, total, grade, remark
  - total/grade/remark computed on server only
  - No score ⇒ result status "Awaiting Result"

## Notifications
- Announcement: title, body, audience (ALL|STUDENTS|TEACHERS|ADMINS), expiresAt?
- AnnouncementRead: userId + announcementId
