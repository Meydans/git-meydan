import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { handler, notFound, readJson, requireFields, resolveId } from "@/lib/api";
import { taskUpdate } from "@/lib/validation";

type Context = RouteContext<"/api/tasks/[id]">;

export const GET = handler(async (_request, { params }: Context) => {
  const id = await resolveId(params, "Task");
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw notFound("Task");
  return Response.json(task);
});

export const PATCH = handler(async (request, { params }: Context) => {
  const id = await resolveId(params, "Task");
  const data = taskUpdate.parse(await readJson(request));
  requireFields(data);
  const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
  if (!task) throw notFound("Task");
  return Response.json(task);
});

export const DELETE = handler(async (_request, { params }: Context) => {
  const id = await resolveId(params, "Task");
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!task) throw notFound("Task");
  return Response.json(task);
});
