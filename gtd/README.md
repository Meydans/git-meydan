# GTD

A personal GTD task manager: Next.js (App Router) + Drizzle ORM + Neon Postgres, deployed to Vercel.
It is a separate Vercel project whose Root Directory is `gtd/`.

## Status

- [x] Stage 1: DB schema + Drizzle migrations
- [x] Stage 2: CRUD API routes for tasks and projects
- [x] Sign-in: Google OAuth with an email allowlist (web UI and API)
- [ ] Stage 3: Minimal UI (Hebrew, RTL)
- [ ] Stage 4: MCP layer over the API

## Data model

`db/schema.ts`:

- **projects**: `id`, `name`, `outcome` (the desired result, per GTD), `status` (`active` | `someday` | `done`), timestamps
- **tasks**: `id`, `title`, `project_id` (optional; set to null when its project is deleted), `status` (`inbox` | `next` | `waiting` | `someday` | `done`), `context` (`@phone` | `@computer` | `@errand` | `@home` | null), `due_date`, `notes`, timestamps

## Database setup

1. In the Vercel project, open Storage and add **Neon** from the Marketplace. This injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. Locally, pull the env vars (`vercel env pull .env.local`) or copy `.env.example` to `.env.local` and fill it in.
3. Apply migrations: `npm run db:migrate`

On Vercel, `npm run build` applies pending migrations before building, so a deploy fails if a migration fails.
Preview and production share one database, so preview deploys also apply migrations.

## Sign-in

The web UI is for allowlisted Google accounts only. Everything except `/login` and `/api/auth/*` redirects to `/login` when there is no valid session; `/api/*` answers `401`.

- Sign-in is Google OAuth (authorization code with PKCE, `state` and `nonce`). The id token is verified against Google's keys, and the email must be verified and listed in `ALLOWED_EMAILS`.
- The session is a signed, HttpOnly, SameSite=Lax cookie that lasts 7 days (`lib/auth/`). Removing an address from `ALLOWED_EMAILS` ends its sessions.
- The proxy (`proxy.ts`) is only an optimistic check. Pages and route handlers verify the session again.
- The API accepts either the session cookie or `Authorization: Bearer $API_TOKEN`, so scripts and the future MCP layer keep working.

Setup:

1. In Google Cloud Console, create an OAuth client of type **Web application**. Add `<APP_URL>/api/auth/callback` as an authorized redirect URI (and `http://localhost:3000/api/auth/callback` for local work).
2. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `SESSION_SECRET` (`openssl rand -hex 32`) and `ALLOWED_EMAILS` in the Vercel project's environment variables, and in `.env.local` for local work. To add another person, add their email to `ALLOWED_EMAILS` and redeploy.
3. Keep `.env.local` out of git (it is already ignored).

## API

Every request needs `Authorization: Bearer $API_TOKEN`, or a signed-in session cookie. Bodies and responses are JSON with camelCase fields.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tasks` | Filters: `?status=`, `?context=` (URL-encode `@` as `%40`), `?projectId=` |
| `POST` | `/api/tasks` | `title` required; `status` defaults to `inbox` |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/:id` | `PATCH` takes any subset of fields; send `null` to clear one |
| `GET` | `/api/projects` | Filter: `?status=` |
| `POST` | `/api/projects` | `name` required; `status` defaults to `active` |
| `GET` / `PATCH` / `DELETE` | `/api/projects/:id` | Deleting a project keeps its tasks and clears their `projectId` |

Task fields: `title`, `projectId`, `status`, `context`, `dueDate` (`YYYY-MM-DD`), `notes`.
Project fields: `name`, `outcome`, `status`.
Unknown fields and invalid values return `400` with per-field `details`; a missing or malformed id returns `404`.

```sh
curl -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"להתקשר לנגר","status":"next","context":"@phone"}' https://<host>/api/tasks
```

`scripts/api-smoke.sh <base-url> <token>` runs the full CRUD flow against any instance and deletes the rows it creates.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Generate a SQL migration after changing `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run dev` | Run the Next.js dev server |
