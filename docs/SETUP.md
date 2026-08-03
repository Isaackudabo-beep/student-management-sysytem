# Installation / setup guide

## Prerequisites

- Node.js 20 or newer
- npm 10+
- A PostgreSQL database ([Neon](https://console.neon.tech) recommended)
- Git (optional, for cloning)

## 1. Clone or extract the project

```bash
cd student-management-system
```

## 2. Database (Neon)

1. Create a project in the Neon console.
2. Copy the **pooled** and **direct** connection strings.
3. Create `api/.env` from the example:

```bash
cd api
cp .env.example .env
```

Recommended values for Neon:

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30&pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
```

> Use the **pooler** host for `DATABASE_URL` and the **direct** host for `DIRECT_URL` (Prisma migrations).

### Optional: Docker Postgres

```bash
docker compose up -d
```

Then point `DATABASE_URL` / `DIRECT_URL` at `localhost:5432` (see `.env.example`).

## 3. API

```bash
cd api
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- Health check: http://localhost:4000/health  
- If `prisma generate` fails with `EPERM` on Windows, stop any running API process and retry.

## 4. Web

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## 5. Sign in

| Role | URL | Email | Password |
|------|-----|-------|----------|
| Admin | `/login/admin` | admin@sms.local | Password123! |
| Teacher | `/login/teacher` | teacher@sms.local | Password123! |
| Student | `/login/student` | student@sms.local | Password123! |

## 6. Typical admin workflow

1. Create **classes** (`JSS1A`, `SS2B`, …).
2. Create **subjects** with matching levels (`JSS1`, `SS2`, …).
3. Create **teachers** and assign subjects for the session (e.g. `2025/2026`).
4. **Register students** — pick class + 5–11 subjects.
5. Teachers enter CA/Exam scores; students see results (or Awaiting Result).
6. Post **announcements** to roles or everyone.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `PrismaClientInitializationError` / can't reach DB | Check Neon project is active; use pooler URL + `connect_timeout=30`; confirm `DIRECT_URL` |
| Login works but wrong portal | Use the portal matching the account role |
| Forced password change loop | Complete `/change-password` after an admin reset |
| `npm install` hangs | Retry; check network/firewall to `registry.npmjs.org` |
| Empty student subjects | Ensure subjects exist for that class **level** before registration |

## Production notes

- Never commit `.env` / `.env.local`
- Rotate any secrets that were shared in chat or screenshots
- Set strong `JWT_SECRET` and restrict `CORS_ORIGIN`
- Prefer `prisma migrate deploy` in CI/CD (not `migrate dev`)
