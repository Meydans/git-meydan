# GTD

A personal GTD task manager: Next.js (App Router) + Drizzle ORM + Neon Postgres, deployed to Vercel.
It is a separate Vercel project whose Root Directory is `gtd/`.

## Status

- [x] Stage 1: DB schema + Drizzle migrations
- [x] Stage 2: CRUD API routes for tasks and projects
- [x] Stage 3: Minimal UI (Hebrew, RTL)
- [x] Stage 4: MCP server with OAuth
- [x] Offline 1: installable app (PWA)
- [x] Offline 2: offline capture queue
- [x] Offline 3: offline reading of synced lists

## Data model

`db/schema.ts`:

- **projects**: `id`, `name`, `outcome` (the desired result, per GTD), `status` (`active` | `someday` | `done`), timestamps
- **tasks**: `id`, `title`, `project_id` (optional; set to null when its project is deleted), `status` (`inbox` | `next` | `waiting` | `someday` | `done`), `context` (`@phone` | `@computer` | `@errand` | `@home` | null), `start_date` (optional defer date), `due_date`, `notes`, timestamps. A check constraint keeps `start_date <= due_date`.

### Start (defer) dates

A task with a `start_date` in the future is hidden from its list (inbox, next, waiting or someday) and from the sidebar counts until that day in Israel time. Then it comes back by itself. Tasks without a start date are available immediately.

Deferred tasks appear in:
- the **Deferred** view (`/deferred`), grouped by start date
- **Scheduled**, if they have a due date
- their project page

Everywhere they appear they are marked "starts on…".

You can set the start date on the task page (with presets, and bounded by the due date so the browser blocks start > due), in quick capture (the calendar button, which also works through the offline queue), through the REST API (`startDate`), and through MCP. There, `list_tasks` leaves deferred tasks out unless `includeDeferred` is set or `list` is `"deferred"`, and `gtd_overview` reports deferred counts and tasks starting today. A start date after the due date returns 400 from the API and a tool error from MCP, and the task page shows an inline message.

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

## Installable app (PWA)

- `app/manifest.ts`: Hebrew/RTL, `standalone` display, starts at `/inbox`. It has `any` and `maskable` icons and two home-screen shortcuts: quick capture (`/inbox?capture=1`, which focuses the capture box) and Next actions.
- Icons are generated from one design: `app/icon.svg` (favicon), `app/apple-icon.png`, and `public/icons/*`.
- `/sw.js` is served by `app/sw.js/route.ts` from `lib/sw-source.ts`, with a version per build (the commit SHA on Vercel). Each deploy therefore installs a fresh worker. The worker:
  - precaches the offline screen together with its scripts and styles
  - caches content-hashed `/_next/static` assets
  - serves pages network-first and keeps copies of app pages for offline reading (see below)
  - It is served with `no-store` so updates reach installed apps, and is registered only in production builds.
  - The route is static, so it runs at build time, and it parses the generated worker: a syntax error fails `next build` instead of silently turning off offline support.
- On Android/Chrome, an "Install app" item appears in the menu whenever the browser offers installation (`beforeinstallprompt`).

### Offline capture

Every capture goes through a local queue, online or not. `lib/offline-queue.ts` writes it to IndexedDB first, then sends it to `POST /api/capture`, so nothing typed is lost to a dead connection.

- **Idempotent:** each item carries a UUID created on the device, which becomes the task id. Retries are acknowledged instead of creating duplicates. Capture order is kept, and a project deleted while an item was queued doesn't block it.
- **Syncs when:**
  - the network comes back (`online`)
  - the app returns to the foreground
  - every 30 seconds while the server is unreachable
  - on Android, through **Background Sync**: the service worker sends the queue even if the app is closed
- **Status:** a bar on every page shows items still waiting and why (offline, server unreachable, or signed out).
- **Opening the app with no network** lands on `/offline`, which is a capture screen: items queue on the device and reach the inbox later.
- `/api/capture` requires the browser session and JSON (SameSite=Lax cookie), so other sites can't post to it.

### Offline reading

- **Saved pages:** every app page you open online (lists, projects, project and task pages) is saved on the device, network-first. Without a network you get the last saved copy. An unsaved URL with filters falls back to the saved list, and a page never opened falls back to the offline capture screen.
- **Background refresh:** while online, the app asks the service worker to refresh all seven main lists, at most every 10 minutes, so they're current even if you only looked at the inbox. A new service worker does the same when it installs.
- **Read-only snapshots:** a page served from the cache is marked, and shows "offline view, as of <time>". Edit controls are disabled, since they need the server. Capture keeps working through the queue.
- **Scope and privacy:**
  - Saved pages belong to one build (their HTML references that build's scripts), and a deploy replaces them.
  - At most 80 pages are kept.
  - Login, OAuth and API responses are never cached.
  - **Logging out deletes the saved pages**, and so does any response that redirects to the login page (an expired session).

## API

Every request needs `Authorization: Bearer $API_TOKEN`. Bodies and responses are JSON with camelCase fields.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tasks` | Filters: `?status=`, `?context=` (URL-encode `@` as `%40`), `?projectId=`. Returns deferred tasks too |
| `POST` | `/api/tasks` | `title` required; `status` defaults to `inbox` |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/:id` | `PATCH` takes any subset of fields; send `null` to clear one |
| `GET` | `/api/projects` | Filter: `?status=` |
| `POST` | `/api/projects` | `name` required; `status` defaults to `active` |
| `GET` / `PATCH` / `DELETE` | `/api/projects/:id` | Deleting a project keeps its tasks and clears their `projectId` |

Task fields: `title`, `projectId`, `status`, `context`, `startDate` and `dueDate` (`YYYY-MM-DD`), `notes`.
Project fields: `name`, `outcome`, `status`.
Unknown fields and invalid values return `400` with per-field `details`; a missing or malformed id returns `404`.

```sh
curl -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"להתקשר לנגר","status":"next","context":"@phone"}' https://<host>/api/tasks
```

`scripts/api-smoke.sh <base-url> <token>` runs the full CRUD flow against any instance and deletes the rows it creates.

## MCP (Claude)

`/api/mcp` is a remote MCP server (Streamable HTTP, built on `mcp-handler`) exposing the GTD system to Claude.

| Tool | What it does |
| --- | --- |
| `gtd_overview` | Today's date, counts per list, overdue and due-today tasks, the inbox, and active projects with no next action |
| `list_tasks` | Tasks in a list (or all open ones), filtered by context, project or text |
| `get_task` / `create_tasks` / `update_task` / `delete_task` | Task CRUD. `create_tasks` takes a batch and defaults to the inbox; `update_task` with `status: "done"` completes a task |
| `list_projects` / `get_project` | Projects with outcome, per-list counts, progress, and whether they have a next action |
| `create_project` / `update_project` / `delete_project` | Project CRUD. `create_project` can create its first next actions in the same call |

There is also a `weekly_review` prompt, and server instructions that explain the GTD lists and contexts to the model.

### Task links and calendar events

- Every task and project in a tool result has a `url`, its canonical link: `https://<app>/tasks/{id}` (or `/projects/{id}`).
- The server instructions tell Claude that whenever it creates, updates or syncs a calendar event for a task (with any calendar tool), it puts the task's url at the start of the event description and in the event's location or URL field.
- The link's origin is `APP_URL` if set, otherwise Vercel's production domain, otherwise the request's host. Links in calendar events therefore never point at a preview deployment.
- Opening a link:
  - On Android the installed app handles it (`handle_links: "preferred"`, reusing an open window).
  - Signed out, you land on the task right after logging in; `next` is limited to same-site paths.
  - A deleted task shows a friendly not-found page.
  - The task page also has a "copy link" button, which uses the share sheet on phones.

### Auth

- **OAuth 2.1**, for claude.ai (web and mobile) and Claude Desktop. The app is its own authorization server:
  - discovery via `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`
  - Dynamic Client Registration at `/oauth/register`, plus Client ID Metadata Documents (https `client_id`)
  - `/oauth/authorize`: a Hebrew consent screen. It asks for `APP_PASSWORD` unless you're already signed in, and can't be framed.
  - `/oauth/token`: PKCE S256 is required, codes are single-use, and refresh tokens rotate
  - Access tokens last 1 hour and refresh tokens 90 days. They are stored only as SHA-256 hashes and bound to this server's `/api/mcp` resource.
  - **Changing `APP_PASSWORD` revokes every OAuth token.**
- **`API_TOKEN` as a bearer token** also works, for Claude Code and scripts.

### Connecting

- **claude.ai** (also syncs to the mobile app): Settings → Connectors → Add custom connector → `https://<host>/api/mcp`. Claude runs the OAuth flow; approve it on the consent screen.
- **Claude Code**: `claude mcp add --transport http gtd https://<host>/api/mcp --header "Authorization: Bearer $API_TOKEN"`
- **Checks**: `scripts/mcp-smoke.sh <base-url> <token>` runs discovery, the 401 challenge, `initialize`, `tools/list` and `gtd_overview`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Generate a SQL migration after changing `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run dev` | Run the Next.js dev server |
