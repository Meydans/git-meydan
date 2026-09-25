import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { handler, readJson, searchParams } from "@/lib/api";
import { taskCreate, taskFilters } from "@/lib/validation";

export const GET = handler(async (request) => {
  const filters = taskFilters.parse(searchParams(request));
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        filters.status ? eq(tasks.status, filters.status) : undefined,
        filters.context ? eq(tasks.context, filters.context) : undefined,
        filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
      ),
    )
    .orderBy(asc(tasks.createdAt));
  return Response.json(rows);
});

export const POST = handler(async (request) => {
  const data = taskCreate.parse(await readJson(request));
  const [task] = await db.insert(tasks).values(data).returning();
  return Response.json(task, { status: 201 });
});
