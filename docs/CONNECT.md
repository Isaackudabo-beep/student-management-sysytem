# Connect Vercel (frontend) ↔ Render (API)

The web app calls the API using `NEXT_PUBLIC_API_URL`.
The API only allows browser requests from `CORS_ORIGIN`.

## 1. Get your URLs

- **Frontend:** Vercel → Project → Domains  
  Example: `https://student-management-sysytem.vercel.app`
- **Backend:** Render → Web Service → URL  
  Example: `https://sms-api-xxxx.onrender.com`  
  Check it works: open `https://YOUR-API.onrender.com/health`

## 2. Vercel environment variable

Vercel → Project → **Settings** → **Environment Variables**

| Name | Value | Environments |
|------|--------|----------------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API.onrender.com` | Production, Preview |

- No trailing slash
- Must start with `https://`

Then **Deployments** → **⋯** → **Redeploy** (rebuild required — `NEXT_PUBLIC_*` is baked in at build time).

## 3. Render environment variable

Render → API service → **Environment**

| Key | Value |
|-----|--------|
| `CORS_ORIGIN` | `https://YOUR-APP.vercel.app` |

No trailing slash. If you also use a custom domain:

```text
https://YOUR-APP.vercel.app,https://www.yourdomain.com
```

Save → **Manual Deploy** (or restart the service).

## 4. Confirm it works

1. Open the Vercel site
2. Open DevTools → Network
3. Try Admin login (`admin@sms.local` / `Password123!` after seed)
4. Requests should go to `https://YOUR-API.onrender.com/api/...` with status 200

## Common failures

| Symptom | Fix |
|---------|-----|
| Login says cannot reach API | `NEXT_PUBLIC_API_URL` missing/wrong, or forgot to redeploy Vercel |
| CORS / blocked in console | `CORS_ORIGIN` must exactly match the Vercel origin (https, no slash) |
| First request hangs ~1 min | Render free tier cold start — wait and retry |
| 404 on API routes | API Root Directory must be `api`; `/health` must work |
