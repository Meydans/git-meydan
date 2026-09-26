"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { toggleLine } from "@/lib/notes";
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

const taskFields = (formData: FormData) =>
  taskCreate.parse({
    ...formFields(formData, ["projectId", "context", "dueDate", "notes"]),
    title: formData.get("title") ?? "",
    status: formData.get("status") || undefined,
  });

const projectFields = (formData: FormData) =>
  projectCreate.parse({
    ...formFields(formData, ["outcome"]),
    name: formData.get("name") ?? "",
    status: formData.get("status") || undefined,
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
  await db.update(tasks).set(taskFields(formData)).where(eq(tasks.id, formId(formData)));
  refresh();
  redirect(returnTo(formData, "/inbox"));
}

export async function setTaskStatus(formData: FormData) {
  await requireSession();
  const status = taskStatusValue.parse(formData.get("status"));
  await db.update(tasks).set({ status }).where(eq(tasks.id, formId(formData)));
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
