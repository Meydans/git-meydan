"use server";

import { and, asc, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { toggleLine } from "@/lib/notes";
import { taskRuleCode } from "@/lib/pg";
import { safePath } from "@/lib/safe-path";
import { checkPassword, endSession, requireSession, startSession } from "@/lib/session";
import { idParam, projectCreate, taskCreate, taskStatusValue } from "@/lib/validation";
import { z } from "zod";

// Form fields arrive as strings; an empty optional field means "no value".
function formFields(formData: FormData, names: string[]) {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" && value.trim() !== "" ? value : null];
    }),
  );
}

// A checkbox only submits when checked; forms that show it also send "<name>-shown" so an
// unchecked box means false rather than "not part of this form".
function checkbox(formData: FormData, name: string) {
  if (formData.has(name)) return true;
  return formData.has(`${name}-shown`) ? false : undefined;
}

const taskFields = (formData: FormData) =>
  taskCreate.parse({
    ...formFields(formData, ["projectId", "parentId", "context", "startDate", "dueDate", "notes"]),
    title: formData.get("title") ?? "",
    status: formData.get("status") || undefined,
    sequential: checkbox(formData, "sequential"),
  });

const projectFields = (formData: FormData) =>
  projectCreate.parse({
    ...formFields(formData, ["outcome"]),
    name: formData.get("name") ?? "",
    status: formData.get("status") || undefined,
    sequential: checkbox(formData, "sequential"),
  });

const formId = (formData: FormData) => idParam.parse(formData.get("id"));

function returnTo(formData: FormData, fallback: string) {
  return safePath(formData.get("returnTo"), fallback);
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function login(formData: FormData) {
  const next = safePath(formData.get("next"));
  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    redirect(`/login?error=1${next === "/" ? "" : `&next=${encodeURIComponent(next)}`}`);
  }
  await startSession();
  redirect(next);
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function updateTask(formData: FormData) {
  await requireSession();
  const id = formId(formData);
  try {
    await db.update(tasks).set(taskFields(formData)).where(eq(tasks.id, id));
  } catch (error) {
    // Date order, nesting and similar rules come back to the form as an inline message.
    const rule = taskRuleCode(error);
    if (!rule) throw error;
    redirect(`/tasks/${id}?rule=${rule}&from=${encodeURIComponent(returnTo(formData, "/inbox"))}`);
  }
  refresh();
  redirect(returnTo(formData, "/inbox"));
}

export async function setTaskStatus(formData: FormData) {
  await requireSession();
  const status = taskStatusValue.parse(formData.get("status"));
  await db.update(tasks).set({ status }).where(eq(tasks.id, formId(formData)));
  refresh();
}

// Moves a task one step up or down among its open siblings: the same parent's subtasks,
// or the same project's top-level tasks. Swapping positions keeps everyone else in place.
export async function moveTask(formData: FormData) {
  await requireSession();
  const id = formId(formData);
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  await db.transaction(async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
    if (!task || (!task.parentId && !task.projectId)) return;
    const scope = task.parentId ? eq(tasks.parentId, task.parentId) : and(eq(tasks.projectId, task.projectId!), isNull(tasks.parentId));
    const [neighbour] = await tx
      .select()
      .from(tasks)
      .where(
        and(
          scope,
          ne(tasks.status, "done"),
          direction === "up" ? lt(tasks.position, task.position) : gt(tasks.position, task.position),
        ),
      )
      .orderBy(direction === "up" ? desc(tasks.position) : asc(tasks.position))
      .limit(1);
    if (!neighbour) return;
    await tx.update(tasks).set({ position: neighbour.position }).where(eq(tasks.id, task.id));
    await tx.update(tasks).set({ position: task.position }).where(eq(tasks.id, neighbour.id));
  });
  refresh();
}

export async function createSubtask(formData: FormData) {
  await requireSession();
  const parentId = idParam.parse(formData.get("parentId"));
  const title = z.string().trim().min(1).max(500).parse(formData.get("title"));
  try {
    await db.insert(tasks).values({ title, parentId, status: "next" });
  } catch (error) {
    const rule = taskRuleCode(error);
    if (!rule) throw error;
    redirect(`/tasks/${parentId}?rule=${rule}`);
  }
  refresh();
}

export async function setSequential(formData: FormData) {
  await requireSession();
  const id = formId(formData);
  const sequential = formData.get("sequential") === "true";
  if (formData.get("kind") === "project") await db.update(projects).set({ sequential }).where(eq(projects.id, id));
  else await db.update(tasks).set({ sequential }).where(eq(tasks.id, id));
  refresh();
}

export async function toggleChecklistItem(formData: FormData) {
  await requireSession();
  const id = formId(formData);
  const line = z.coerce.number().int().min(0).parse(formData.get("line"));
  const [task] = await db.select({ notes: tasks.notes }).from(tasks).where(eq(tasks.id, id));
  if (!task?.notes) return;
  await db.update(tasks).set({ notes: toggleLine(task.notes, line) }).where(eq(tasks.id, id));
  refresh();
}

export async function deleteTask(formData: FormData) {
  await requireSession();
  await db.delete(tasks).where(eq(tasks.id, formId(formData)));
  refresh();
  redirect(returnTo(formData, "/inbox"));
}

export async function createProject(formData: FormData) {
  await requireSession();
  const [project] = await db.insert(projects).values(projectFields(formData)).returning({ id: projects.id });
  refresh();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(formData: FormData) {
  await requireSession();
  await db.update(projects).set(projectFields(formData)).where(eq(projects.id, formId(formData)));
  refresh();
}

export async function deleteProject(formData: FormData) {
  await requireSession();
  await db.delete(projects).where(eq(projects.id, formId(formData)));
  refresh();
  redirect("/projects");
}
