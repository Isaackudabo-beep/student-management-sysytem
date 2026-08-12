# Deploy the API on Render

## Exact dashboard settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `api` |
| **Build Command** | `npm install --include=dev && npx prisma generate && npm run build` |
| **Start Command** | `npm run start:render` |

`start:render` always runs **`npx prisma migrate deploy`** before booting the server so new schema changes apply automatically.

Then **Manual Deploy → Clear build cache & deploy**.

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon **pooled** connection string |
| `DIRECT_URL` | **Yes (critical)** | Neon **direct / non-pooled** host — used for `ensure-schema` DDL and `prisma migrate deploy`. Without this, multi-school columns (`School`, `schoolId`) may never apply and school APIs return schema errors. |
| `JWT_SECRET` | Yes | |
| `CORS_ORIGIN` | Yes | Exact Vercel URL(s), comma-separated OK |
| `NODE_ENV` | Yes | `production` |

Do not set `PORT`.

## Start behaviour

`npm run start:render` will:

1. Run **ensure-schema** (idempotent DDL for legacy + multi-school) and **fail boot** if `School` / `schoolId` are missing  
2. Mark known migrations applied only after that verify succeeds  
3. Run `prisma migrate deploy`  
4. Seed `admin@sms.local` and `superadmin@sms.local` (platform seed only — no public Super Admin signup)  
5. Start the API  

## Verify

`https://YOUR-SERVICE.onrender.com/health` → `{"success":true,...}`

## Why dist/index.js was missing

Render often builds with `NODE_ENV=production`, which skips install of compile tooling, or the build never ran `tsc` in the `api` folder. The API `build` script now compiles TypeScript and **fails the deploy** if `dist/index.js` is not created.
