import { cookies } from "next/headers";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects, taskStatus, tasks } from "@/db/schema";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

// Sync target for the offline capture queue. Authenticated by the browser session cookie
// (SameSite=Lax, and JSON-only, so cross-site pages can't post here).
const body = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(500),
        status: z.enum(taskStatus.enumValues).default("inbox"),
        projectId: z.uuid().optional(),
        startDate: z.iso.date().optional(),
        capturedAt: z.iso.datetime(),
      }),
    )
    .max(200),
});

export async function POST(request: Request) {
  if (!isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Expected JSON" }, { status: 415 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", details: z.flattenError(parsed.error) }, { status: 400 });
  const { items } = parsed.data;
  if (items.length === 0) return Response.json({ synced: [] });

  // A project deleted while the item sat in the queue shouldn't block the capture.
  const projectIds = [...new Set(items.flatMap((i) => (i.projectId ? [i.projectId] : [])))];
  const existing = projectIds.length
    ? new Set((await db.select({ id: projects.id }).from(projects).where(inArray(projects.id, projectIds))).map((p) => p.id))
    : new Set<string>();

  const now = Date.now();
  await db
    .insert(tasks)
    .values(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        projectId: i.projectId && existing.has(i.projectId) ? i.projectId : null,
        startDate: i.startDate ?? null,
        // Keep capture order, but never trust a clock that runs ahead of the server.
        createdAt: new Date(Math.min(Date.parse(i.capturedAt), now)),
        updatedAt: sql`now()`,
      })),
    )
    // Retries resend the same ids; already-synced items are acknowledged, not duplicated.
    .onConflictDoNothing({ target: tasks.id });

  return Response.json({ synced: items.map((i) => i.id) });
}
