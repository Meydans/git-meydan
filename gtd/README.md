# GTD

A personal GTD task manager: Next.js (App Router) + Drizzle ORM + Neon Postgres, deployed to Vercel.
It is a separate Vercel project whose Root Directory is `gtd/`.

## Status

- [x] Stage 1: DB schema + Drizzle migrations
- [ ] Stage 2: CRUD API routes for tasks and projects
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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Generate a SQL migration after changing `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run dev` | Run the Next.js dev server |
