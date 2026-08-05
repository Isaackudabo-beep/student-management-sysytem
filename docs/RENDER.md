# Deploy the API on Render

This repo is a **monorepo**. The API is in the **`api`** folder.

## Dashboard settings (copy exactly)

| Setting | Value |
|---------|--------|
| **Root Directory** | `api` |
| **Runtime** | Node |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm run start:render` |

> **Why `--include=dev`?** Render sets `NODE_ENV=production` during build. Without `--include=dev`, npm skips build tools and the deploy fails on `tsc` / types.

## Environment variables

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon **pooler** URL (`…-pooler…` + `sslmode=require`) |
| `DIRECT_URL` | Neon **direct** URL (no `-pooler`) |
| `JWT_SECRET` | Long random string (16+ chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://your-app.vercel.app` (no trailing slash) |
| `NODE_ENV` | `production` |

Do **not** set `PORT` — Render injects it.

## After you change settings

1. **Manual Deploy** → enable **Clear build cache & deploy**
2. Open `https://YOUR-SERVICE.onrender.com/health`
3. Expect: `{"success":true,"message":"SMS API is healthy"}`
4. On Vercel set `NEXT_PUBLIC_API_URL` to that Render URL and redeploy the web app

## Seed demo users (from your laptop)

```powershell
cd api
# .env must use the same Neon DATABASE_URL / DIRECT_URL
npm run db:seed
```

## Free tier

Render free services sleep when idle. First request after sleep can take 30–60s.
