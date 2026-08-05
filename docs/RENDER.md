# Deploy the API on Render

This repo is a **monorepo**. The API is in the **`api`** folder (same idea as Vercel needing `web`).

## Fix a failed / unreachable deploy

### 1. Root Directory (most common)

In Render → your Web Service → **Settings**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `api` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:render` |

`start:render` runs migrations, then starts the server.

### 2. Environment variables

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon **pooler** URL (`…-pooler…` + `sslmode=require`) |
| `DIRECT_URL` | Neon **direct** URL (no `-pooler`) |
| `JWT_SECRET` | Long random string (16+ chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://your-app.vercel.app` (no trailing slash) |
| `NODE_ENV` | `production` |

Do **not** set `PORT` yourself — Render injects it.

### 3. After deploy

1. Open `https://YOUR-SERVICE.onrender.com/health`  
   Expect: `{"success":true,"message":"SMS API is healthy"}`
2. On Vercel, set `NEXT_PUBLIC_API_URL` = `https://YOUR-SERVICE.onrender.com`
3. Redeploy the Vercel app (so the browser picks up the API URL)

### 4. Seed demo users (optional, once)

In Render → Shell (or locally against Neon):

```bash
cd api
npx tsx prisma/seed.ts
```

(Requires `tsx` — on Render you can run from a one-off job, or seed from your laptop with the same `DATABASE_URL`.)

From your laptop:

```powershell
cd api
# ensure .env points at Neon
npm run db:seed
```

## Blueprint (optional)

Repo includes `render.yaml`. In Render: **New** → **Blueprint** → select this repo, then fill in the `sync: false` env vars when prompted.

## Free tier note

Render free web services **spin down** after idle. The first request after sleep can take ~30–60s; Neon cold start can add more. That looks like a hang, not always a crash.
