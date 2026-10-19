# Deploying Strauss Car Advisor

One Node.js service serves both the API and the built client. The client holds no secrets and
never reaches the database or the model: everything goes through `/api`.

```
Browser (src/, React)  ──HTTPS /api──▶  API layer (server/api)
                                           │ validation, CORS, rate limits, login cookies + roles
                                           ▼
                                        Business logic (server/bl)
                                           │ engine, agent, Gemini client, services
                                           ▼
                                        Data access (server/dal) ──▶ Supabase (service role) or local JSON
```

## 1. Database (Supabase)

1. Run `supabase/schema.sql` in the Supabase SQL editor. It creates the tables, enables RLS with no
   policies and revokes all access from `anon`/`authenticated`. Only the service role can read data.
2. Copy the project URL and the **service role** key (Settings → API). Never put this key in client
   code or in a `VITE_*` variable.
3. Users: Authentication → Providers → Email on, "Allow new users to sign up" off. Create each user
   under Authentication → Users (Auto Confirm). The trigger in `schema.sql` gives every new user the
   role `employee`; promote with
   `UPDATE app_users SET role = 'rep' WHERE user_id = (SELECT id FROM auth.users WHERE email = '...');`

Roles and screens:

| Role | Screens | API |
|---|---|---|
| `employee` | Employee | own conversations (`/sessions`), `/payslip`, `/meta` |
| `rep` | Employee, Rep | as employee + `/tickets` |
| `admin` | all, incl. Data | as rep + `/admin` |

Without a login every API call except `/auth`, `/health` and `/tickets/summary` returns 401; a
role that is not allowed gets 403; someone else's conversation is 404. A user with no `app_users`
row cannot log in. A role change reaches a logged-in user within 60 seconds (token cache).

Without Supabase the server has no login (every screen is open) and stores data as JSON files in
`DATA_DIR`. Development only; production refuses to start without Supabase.

## 2. Environment variables

All are server-side; see `.env.example` for the full list.

| Variable | Production |
|---|---|
| `GEMINI_API_KEY` | required |
| `GEMINI_MODEL` | recommended, e.g. `gemini-3.5-flash-lite,gemini-3.1-flash-lite` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | required (storage and login) |
| `TRUST_PROXY` | `1` behind a load balancer (Cloud Run, Render, Fly, nginx) |
| `ALLOWED_ORIGINS` | only if another site must call the API |

The server refuses to start in production when a required variable is missing, and warns about the
old `VITE_SUPABASE_*` / `VITE_FALLBACK_*` names and the unused `REP_ACCESS_TOKEN` / `ADMIN_ACCESS_TOKEN`.

Generate user passwords with: `node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"`

## 3. Build and run

```bash
docker build -t strauss-car-advisor .
docker run -p 8080:8080 --env-file .env.production strauss-car-advisor
```

Without Docker: `npm ci && npm run build && npm start` (Node 20.11+). `npm start` always runs in
production mode.

Health check: `GET /api/health` returns `{ "status": "ok" }`.

## 4. Scaling notes

- Rate limits and per-session locks are in memory. With several instances, use sticky sessions or
  accept per-instance limits; data stays consistent in Supabase.
- Admin rule changes are applied in memory on the instance that saved them and loaded by the
  others at their next start.
- Serverless: see section 5 (Vercel). Each function instance has its own rate limits, session
  locks and rule cache, as with several instances above.

## 5. Vercel

`vercel.json` runs `vite build && node scripts/vercel-build.mjs`, which writes `.vercel/output`
(Build Output API): `dist/` as static files and one Node function (`server/vercel.ts`, bundled by
esbuild) for `/api/*`, with response streaming and `maxDuration` 60s. Vercel's own TypeScript
builder is not used (it cannot compile TypeScript 7).

1. Import the GitHub repo in Vercel (Framework preset: Other; the settings come from `vercel.json`).
2. Environment variables (Production): `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `TRUST_PROXY=1`. Not `PORT`, `HOST`, `DATA_DIR` or any `VITE_*`.
3. Check `https://<project>.vercel.app/api/health` returns `{ "status": "ok" }`, then log in.

Local check of the output: `npx vite build && node scripts/vercel-build.mjs`.
