# Fix Vercel 404 (this monorepo)

Your Next.js app lives in the **`web`** folder, not the repo root. If Vercel builds the root, the deploy “succeeds” but every page returns **404**.

## Fix (required)

1. Open your project on [vercel.com](https://vercel.com) → **Settings** → **General**
2. Find **Root Directory** → **Edit**
3. Set it to: `web`
4. Leave **Include source files outside of the Root Directory** unchecked (default)
5. **Save**
6. Go to **Deployments** → open the latest → **⋯** → **Redeploy** (uncheck “Use existing Build Cache” if available)

## Environment variable

**Settings** → **Environment Variables** → add for Production:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | Your live API URL, e.g. `https://your-api.onrender.com` (no trailing slash) |

Without this, the site may load but login/API calls will fail.

## Build settings (should look like this after Root = `web`)

- Framework Preset: **Next.js**
- Build Command: `npm run build` (or leave default)
- Output Directory: **leave empty** (do not set `public` or `.next`)
- Install Command: `npm install` (default)

## Important

- Vercel hosts **only the frontend** (`web`)
- The **API** (`api`) must be hosted separately (Render / Railway / Fly)
- Point `NEXT_PUBLIC_API_URL` at that API
- On the API, set `CORS_ORIGIN` to your Vercel URL, e.g. `https://your-app.vercel.app`
