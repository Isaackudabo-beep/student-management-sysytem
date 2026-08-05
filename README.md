# Student Management System

Full-stack **secondary school** management application for classes (JSS/SS), students, teachers, subjects, enrollments, scores, results, and announcements.

## Technologies used

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, TypeScript |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL (Neon recommended) + Prisma ORM |
| Auth | JWT + bcrypt, role-based access (Admin / Teacher / Student) |

## Features

See **[docs/FEATURES.md](docs/FEATURES.md)** for the full feature list, partial items, and planned improvements.

Highlights:

- Separate **Admin / Teacher / Student** login portals
- **SchoolClass** support (`JSS1A`, `SS2B`, …)
- Rich student profiles (gender, DOB, phone, address, admission number, parent/guardian)
- Admin registers students and selects **5–11 subjects**; enrollments are created automatically
- Scores: CA `/40` + Exam `/60` → total, grade, remark (server-side)
- **Awaiting Result** until a teacher enters scores
- Admin password reset + forced change on next login
- Announcement center (audience + optional expiry + mark as read)
- Role-specific dashboards

## Project structure

```text
student-management-system/
├── api/                 # Express REST API
│   ├── prisma/          # Schema, migrations, seed
│   └── src/
├── web/                 # Next.js UI
├── docs/                # Domain, setup, features
├── docker-compose.yml   # Optional local Postgres
└── README.md
```

## Prerequisites

- Node.js **20+**
- PostgreSQL **14+** via [Neon](https://neon.tech) (recommended) or local install
- Optional: Docker Desktop for local Postgres only

## Installation guide

Detailed steps: **[docs/SETUP.md](docs/SETUP.md)**

### Quick start (Neon)

1. Create a Neon project and copy the connection URI.
2. Configure API env:

```bash
cd api
cp .env.example .env
```

Edit `api/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30&pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"
JWT_SECRET="a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
```

3. Install, migrate, seed, run API:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

API: http://localhost:4000

4. Configure and run web:

```bash
cd ../web
cp .env.example .env.local
npm install
npm run dev
```

Web: http://localhost:3000

### Demo accounts (after seed)

| Role | Portal | Email | Password |
|------|--------|-------|----------|
| Admin | `/login/admin` | admin@sms.local | Password123! |
| Teacher | `/login/teacher` | teacher@sms.local | Password123! |
| Student | `/login/student` | student@sms.local | Password123! |

## Screenshots

> Optional: add PNGs under `docs/screenshots/` and link them here.

| Screen | Path |
|--------|------|
| Landing / portals | `docs/screenshots/landing.png` |
| Admin dashboard | `docs/screenshots/admin-dashboard.png` |
| Student registration | `docs/screenshots/student-register.png` |
| Student results | `docs/screenshots/student-results.png` |
| Announcements | `docs/screenshots/announcements.png` |

```markdown
![Landing](docs/screenshots/landing.png)
```

## Core business rules

- Assessment `/40` + Exam `/60` = Total `/100`
- Grades: A≥70, B≥60, C≥50, D≥45, E≥40, F&lt;40
- Server computes `total`, `grade`, and `remark`
- Teachers only score subjects assigned via `TeacherSubject`
- Students only see their own results
- Related records block unsafe deletes

## API overview

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/login` | Public (`expectedRole` required) |
| POST | `/api/auth/change-password` | Auth |
| POST | `/api/auth/admin/reset-password` | Admin |
| POST | `/api/auth/forgot-password` | Public (stub — no email yet) |
| GET | `/api/auth/me` | Auth |
| CRUD | `/api/classes` | Admin (list: auth) |
| CRUD | `/api/students` | Admin write; Admin/Teacher list |
| CRUD | `/api/teachers` | Admin |
| POST | `/api/teachers/assign-subject` | Admin |
| CRUD | `/api/subjects` | Admin write; Admin/Teacher list |
| CRUD | `/api/enrollments` | Admin write; teacher-scoped list |
| POST/GET | `/api/scores` | Teacher enter; role-filtered list |
| GET | `/api/scores/results/:studentId` | Own student / Admin / Teacher |
| GET | `/api/dashboard` | Auth (role-aware) |
| CRUD | `/api/announcements` | Admin write; inbox/read for all |

## Deployment (recommended)

1. **Database** — Neon / Supabase / Railway Postgres  
2. **API** — Railway / Render / Fly.io  
   - **Root Directory must be `api`**  
   - Build: `npm install && npm run build`  
   - Start: `npm run start:render`  
   - Set `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL)  
   - See [docs/RENDER.md](docs/RENDER.md) for Render settings  
3. **Web** — Vercel  
   - **Root Directory must be `web`** (otherwise you get a successful deploy that 404s)  
   - Set `NEXT_PUBLIC_API_URL` to your API URL  
   - See [docs/VERCEL.md](docs/VERCEL.md) for the 404 fix step-by-step  

## License

Private / portfolio use unless otherwise stated.
