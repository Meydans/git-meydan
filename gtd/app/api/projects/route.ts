import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { handler, readJson, searchParams } from "@/lib/api";
import { projectCreate, projectFilters } from "@/lib/validation";

export const GET = handler(async (request) => {
  const filters = projectFilters.parse(searchParams(request));
  const rows = await db
    .select()
    .from(projects)
    .where(filters.status ? eq(projects.status, filters.status) : undefined)
    .orderBy(asc(projects.createdAt));
  return Response.json(rows);
});

export const POST = handler(async (request) => {
  const data = projectCreate.parse(await readJson(request));
  const [project] = await db.insert(projects).values(data).returning();
  return Response.json(project, { status: 201 });
});
