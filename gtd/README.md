# GTD

A personal GTD task manager: Next.js (App Router) + Drizzle ORM + Neon Postgres, deployed to Vercel.
It is a separate Vercel project whose Root Directory is `gtd/`.

## Status

- [x] Stage 1: DB schema + Drizzle migrations
- [x] Stage 2: CRUD API routes for tasks and projects
- [x] Stage 3: Minimal UI (Hebrew, RTL)
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

## Web UI

Hebrew, right-to-left. Sign in at `/login` with `APP_PASSWORD`, which sets an HttpOnly session cookie for 30 days.

- **Lists**, in a sidebar on desktop and a drawer on mobile, with counts: `/inbox`, `/next`, `/waiting`, `/scheduled`, `/someday`, `/done`.
  - Each list has a capture box that adds to that list, a search box, and context and project filters, all kept in the URL.
  - **Scheduled** is a view, not a status. It shows every open task with a due date, grouped into overdue, today, tomorrow, this week, and later. Its sidebar badge counts overdue tasks.
- **Task cards** show:
  - the project, colored consistently per project
  - context chips
  - relative due dates ("היום", "באיחור 2 ימים"), color-coded by urgency
  - a notes preview
  - Note lines written as `- [ ] item` render as checklist items that can be ticked right on the card, with a progress chip.
- **`/tasks/:id`**: a full edit page with list tabs, context chips, a project picker, and due-date presets.
- **`/projects`**: cards per status with the outcome and a progress bar. Active projects with no next action are flagged.
  - **`/projects/:id`** shows the project's tasks by list, with a capture box that adds next actions to that project.

Pages read the database on the server, and edits go through Server Actions. The browser never sees `API_TOKEN`.
`proxy.ts` sends signed-out visitors to `/login`, and every page and action also checks the session itself.

## API

Every request needs `Authorization: Bearer $API_TOKEN`. Bodies and responses are JSON with camelCase fields.

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
