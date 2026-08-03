# Features

Complete inventory of the secondary-school SMS upgrade.

## Implemented

### Student information
- Gender (required on registration)
- Date of birth, phone, address
- Admission number (unique)
- Parent/guardian name and phone
- Class assignment via `SchoolClass` (e.g. `JSS1A`, `SS2B`)
- Stream/department field
- Zod validation on create/update

### Authentication and portals
- Three portals: `/login/admin`, `/login/teacher`, `/login/student`
- Login requires `expectedRole` — wrong role is rejected (403)
- Role-specific dashboards: `/dashboard/admin|teacher|student`
- JWT auth + bcrypt password hashing
- Middleware RBAC on API routes
- Forced password-change gate when `mustChangePassword` is true

### Password recovery
- **Admin reset password** (students and teachers) with temporary password
- User must change password on next login before using the app
- **Forgot password** endpoint + UI page exist as a **stub** (no email send until SMTP/Resend)

### Subjects and results
- On student registration, admin selects **5–11** subjects filtered by class level
- API creates enrollments in the same transaction
- Subjects without scores show **Awaiting Result**
- After teacher entry: CA, Exam, Total, Grade, Remark
- Students view only their own results
- Grade calculation is server-side only

### Teacher dashboard and scoring
- Teachers see assigned subjects and pending scores
- Enrollment/score lists are scoped to `TeacherSubject` assignments
- Teachers can only enter/edit scores for assigned subjects/sessions

### Admin notifications
- Announcement center (`/announcements`)
- Audiences: Everyone, Students, Teachers, Admins
- Optional expiry date
- Inbox on dashboards + mark as read

### Dashboards
- **Admin:** totals (students, teachers, subjects, classes), recent activity, quick actions, notices
- **Teacher:** assigned subjects, classes, pending scores, notices
- **Student:** personal info, registered subjects, result status, academic summary, notices

### Classes and subjects
- CRUD for school classes
- Subjects keyed by secondary level string (`JSS1`, `SS2`, …)
- Seed data includes sample classes, subjects, enrollments, scores, announcements

### General UX
- Responsive shell (sidebar + mobile nav chips)
- Search + pagination on students (and API meta elsewhere)
- Neon-friendly DB URLs with pooler + connect timeouts

## Partially implemented

| Item | Status |
|------|--------|
| Forgot password via email | Stub only — returns “email not configured”; `PasswordResetToken` table reserved |
| Screenshots in README | Section placeholders only — no image files yet |
| Universal UI pagination | Students have page controls; some list pages still use high `limit` fetches |
| Student edit profile UI | API update supports new fields; dedicated edit form is minimal / list-focused |
| Audit log of password resets | Reset works; no persistent admin audit trail table |
| Rate limiting on login/forgot | Not added |

## Skipped / deferred

| Item | Reason |
|------|--------|
| SMTP / Resend wiring | Deferred by product decision until credentials available |
| Fully automatic subject auto-pick | Admin **manual** 5–11 selection chosen instead |
| Docker-required local DB | Neon path preferred; compose file remains optional |
| Payment / fees module | Out of original scope |
| Timetable / attendance | Out of original scope |
| Multi-term report cards PDF | Not requested in this upgrade |

## Known issues

1. **Neon cold start** — first DB request after idle can take several seconds; mitigated with `connect_timeout` / pooler settings.
2. **Prisma generate on Windows** — can fail with `EPERM` if the API process locks `query_engine-windows.dll.node`; stop the API before `prisma generate`.
3. **Slow / flaky `npm install`** — observed on restricted networks; retries or a warmer cache may be needed.
4. **Legacy `/login`** — redirects to a portal chooser; bookmarks to the old single login still work via chooser.
5. **Destructive upgrade migration** — `20260803120000_secondary_school_upgrade` recreates schema; use seed afterward (not for preserving arbitrary production data without a backup).

## Future improvements

- Wire Resend/SMTP for forgot-password emails using `PasswordResetToken`
- Add login rate limiting and password-reset audit logs
- Student/teacher profile edit screens with full field coverage
- Consistent pagination + filters on every list page
- Export results (CSV/PDF)
- Soft deletes and activity audit trail
- Automated tests (API + critical UI flows)
- CI pipeline (lint, typecheck, migrate dry-run)
