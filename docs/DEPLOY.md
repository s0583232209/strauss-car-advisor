# Deploying Strauss Car Advisor

One Node.js service serves both the API and the built client. The client holds no secrets and
never reaches the database or the model: everything goes through `/api`.

```
Browser (src/, React)  ──HTTPS /api──▶  API layer (server/api)
                                           │ validation, CORS, rate limits, Bearer tokens
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

Without Supabase the server stores data as JSON files in `DATA_DIR`. Use that only for a single
instance with a persistent disk (a Docker volume on `/app/.data`).

## 2. Environment variables

All are server-side; see `.env.example` for the full list.

| Variable | Production |
|---|---|
| `GEMINI_API_KEY` | required |
| `GEMINI_MODEL` | recommended, e.g. `gemini-3.5-flash-lite,gemini-3.1-flash-lite` |
| `REP_ACCESS_TOKEN`, `ADMIN_ACCESS_TOKEN` | required, at least 16 characters, different from each other |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | recommended (both or neither) |
| `TRUST_PROXY` | `1` behind a load balancer (Cloud Run, Render, Fly, nginx) |
| `ALLOWED_ORIGINS` | only if another site must call the API |

The server refuses to start in production when a required variable is missing, and warns about the
old `VITE_SUPABASE_*` / `VITE_FALLBACK_*` names.

Generate access codes with: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`

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
- Serverless platforms that freeze the process between requests (e.g. Vercel functions) do not fit
  this design: the agent turn streams for several seconds.
