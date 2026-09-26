import { z } from "zod";
import { projectStatus, taskContext, taskStatus } from "@/db/schema";

const nullableText = z.string().trim().nullable();

export const taskCreate = z.strictObject({
  title: z.string().trim().min(1),
  projectId: z.uuid().nullable().optional(),
  status: z.enum(taskStatus.enumValues).optional(),
  context: z.enum(taskContext.enumValues).nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  notes: nullableText.optional(),
});

export const taskUpdate = taskCreate.partial();

export const taskFilters = z.object({
  status: z.enum(taskStatus.enumValues).optional(),
  context: z.enum(taskContext.enumValues).optional(),
  projectId: z.uuid().optional(),
});

export const projectCreate = z.strictObject({
  name: z.string().trim().min(1),
  outcome: nullableText.optional(),
  status: z.enum(projectStatus.enumValues).optional(),
});

export const projectUpdate = projectCreate.partial();

export const projectFilters = z.object({
  status: z.enum(projectStatus.enumValues).optional(),
});

export const idParam = z.uuid();

export const taskStatusValue = z.enum(taskStatus.enumValues);
