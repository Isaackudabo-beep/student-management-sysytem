# Deploy the API on Render

## Exact dashboard settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `api` |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm run start:render` |

Then **Manual Deploy → Clear build cache & deploy**.

## Environment variables

`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN` (Vercel URL), `NODE_ENV=production`

Do not set `PORT`.

## Verify

`https://YOUR-SERVICE.onrender.com/health` → `{"success":true,...}`

## Why dist/index.js was missing

Render often builds with `NODE_ENV=production`, which skips install of compile tooling, or the build never ran `tsc` in the `api` folder. The API `build` script now compiles TypeScript and **fails the deploy** if `dist/index.js` is not created.
