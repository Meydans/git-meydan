import { getPublicOrigin } from "mcp-handler";

// Canonical links to tasks and projects, for calendar events and other apps.
// The production domain wins over the request's host so links never point at a
// short-lived preview deployment: APP_URL, then Vercel's production domain, then the request.
export function appOrigin(request?: Request) {
  const explicit = process.env.APP_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  return request ? getPublicOrigin(request) : "http://localhost:3000";
}

export const taskUrl = (origin: string, id: string) => `${origin}/tasks/${id}`;
export const projectUrl = (origin: string, id: string) => `${origin}/projects/${id}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

// Adds a `url` to every task (has a title) and project (has a name) anywhere in a tool result.
export function withLinks(value: unknown, origin: string): unknown {
  if (Array.isArray(value)) return value.map((item) => withLinks(item, origin));
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) out[key] = withLinks(inner, origin);
  if (typeof value.id === "string") {
    if (typeof value.title === "string") out.url = taskUrl(origin, value.id);
    else if (typeof value.name === "string") out.url = projectUrl(origin, value.id);
  }
  return out;
}
