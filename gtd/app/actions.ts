"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { checkPassword, endSession, requireSession, startSession } from "@/lib/session";
import { idParam, projectCreate, taskCreate, taskStatusValue } from "@/lib/validation";

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

export async function login(formData: FormData) {
  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) redirect("/login?error=1");
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function createTask(formData: FormData) {
  await requireSession();
  await db.insert(tasks).values(taskFields(formData));
  revalidatePath("/", "layout");
}

export async function updateTask(formData: FormData) {
  await requireSession();
  await db.update(tasks).set(taskFields(formData)).where(eq(tasks.id, formId(formData)));
  revalidatePath("/", "layout");
}

export async function setTaskStatus(formData: FormData) {
  await requireSession();
  const status = taskStatusValue.parse(formData.get("status"));
  await db.update(tasks).set({ status }).where(eq(tasks.id, formId(formData)));
  revalidatePath("/", "layout");
}

export async function deleteTask(formData: FormData) {
  await requireSession();
  await db.delete(tasks).where(eq(tasks.id, formId(formData)));
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  await requireSession();
  await db.insert(projects).values(projectFields(formData));
  revalidatePath("/", "layout");
}

export async function updateProject(formData: FormData) {
  await requireSession();
  await db.update(projects).set(projectFields(formData)).where(eq(projects.id, formId(formData)));
  revalidatePath("/", "layout");
}

export async function deleteProject(formData: FormData) {
  await requireSession();
  await db.delete(projects).where(eq(projects.id, formId(formData)));
  revalidatePath("/", "layout");
}
