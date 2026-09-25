import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { handler, notFound, readJson, requireFields, resolveId } from "@/lib/api";
import { projectUpdate } from "@/lib/validation";

type Context = RouteContext<"/api/projects/[id]">;

export const GET = handler(async (_request, { params }: Context) => {
  const id = await resolveId(params, "Project");
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) throw notFound("Project");
  return Response.json(project);
});

export const PATCH = handler(async (request, { params }: Context) => {
  const id = await resolveId(params, "Project");
  const data = projectUpdate.parse(await readJson(request));
  requireFields(data);
  const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  if (!project) throw notFound("Project");
  return Response.json(project);
});

// Deleting a project keeps its tasks; the FK sets their projectId to null.
export const DELETE = handler(async (_request, { params }: Context) => {
  const id = await resolveId(params, "Project");
  const [project] = await db.delete(projects).where(eq(projects.id, id)).returning();
  if (!project) throw notFound("Project");
  return Response.json(project);
});
