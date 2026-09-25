import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { projectStatus, taskContext, taskStatus } from "@/db/schema";
import { lists } from "@/lib/lists";
import * as service from "@/lib/service";

const id = z.uuid();
const status = z.enum(taskStatus.enumValues);
const context = z.enum(taskContext.enumValues);
const dueDate = z.iso.date().describe("Calendar date, YYYY-MM-DD, in the user's timezone (Asia/Jerusalem)");

const taskFields = {
  title: z.string().trim().min(1).max(500),
  status: status.describe("inbox = captured, not yet clarified; next = the next physical action; waiting = delegated or blocked on someone; someday = maybe later; done = completed"),
  context: context.nullable().describe("Where or with what the action can be done. null clears it"),
  projectId: id.nullable().describe("Project this task belongs to. null detaches it"),
  dueDate: dueDate.nullable(),
  notes: z.string().max(10_000).nullable().describe('Free text. Lines like "- [ ] item" render as a checklist in the app'),
};

const projectFields = {
  name: z.string().trim().min(1).max(200),
  outcome: z.string().max(2000).nullable().describe("The desired outcome: what 'done' looks like for this project"),
  status: z.enum(projectStatus.enumValues),
};

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Tool results are JSON text; a missing row becomes a tool error the model can react to.
async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn(), null, 1) }] };
  } catch (error) {
    if (error instanceof service.NotFound) return { content: [{ type: "text", text: error.message }], isError: true };
    if ((error as { cause?: { code?: string } })?.cause?.code === "23503") {
      return { content: [{ type: "text", text: "projectId does not reference an existing project" }], isError: true };
    }
    throw error;
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const destructive = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export const instructions = `This server is the user's personal GTD (Getting Things Done) system. Task and project text is usually Hebrew; keep the user's language when creating or editing items.
Lists: inbox (captured, unprocessed), next (next physical actions), waiting (waiting on someone), someday (maybe later), done. "scheduled" is a view of open tasks that have a due date.
Contexts: @phone, @computer, @errand, @home. Every active project should have at least one task in "next".
Start with gtd_overview to see today's date, counts, overdue items and stuck projects. New thoughts go to the inbox unless the user says otherwise.`;

export function registerTools(server: McpServer) {
  server.registerTool(
    "gtd_overview",
    {
      title: "GTD overview",
      description: "Snapshot of the whole system: today's date, how many tasks are in each list, overdue and due-today tasks, inbox items waiting to be processed, and active projects that have no next action. Use first, and for daily or weekly reviews.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    () => run(() => service.overview()),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks in one GTD list, optionally filtered by context, project or a text search over title and notes. Without a list, returns all open (not done) tasks.",
      inputSchema: z.object({
        list: z.enum([...lists, "open"]).default("open").describe('A GTD list, "scheduled" (open tasks with a due date), or "open" (every task not done)'),
        context: context.optional(),
        projectId: id.optional(),
        query: z.string().trim().min(1).max(200).optional().describe("Case-insensitive substring match on title and notes"),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      annotations: readOnly,
    },
    ({ list, context, projectId, query, limit }) => run(() => service.findTasks(list, { context, projectId, q: query }, limit)),
  );

  server.registerTool(
    "get_task",
    { title: "Get task", description: "Full details of one task, including its notes.", inputSchema: z.object({ id }), annotations: readOnly },
    ({ id }) => run(() => service.getTask(id)),
  );

  server.registerTool(
    "create_tasks",
    {
      title: "Create tasks",
      description: "Create one or more tasks. Status defaults to inbox, which is right for quick capture; set status, context, project and due date when the user has already clarified the item.",
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              title: taskFields.title,
              status: taskFields.status.default("inbox"),
              context: taskFields.context.optional(),
              projectId: taskFields.projectId.optional(),
              dueDate: taskFields.dueDate.optional(),
              notes: taskFields.notes.optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
      annotations: write,
    },
    ({ tasks }) => run(() => service.createTasks(tasks)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: 'Change any fields of a task: move it between lists (e.g. status "done" to complete it), set or clear its context, project, due date or notes, or rename it. Only the fields you pass change; pass null to clear an optional field.',
      inputSchema: z.object({
        id,
        title: taskFields.title.optional(),
        status: taskFields.status.optional(),
        context: taskFields.context.optional(),
        projectId: taskFields.projectId.optional(),
        dueDate: taskFields.dueDate.optional(),
        notes: taskFields.notes.optional(),
      }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ id, ...changes }) =>
      run(async () => {
        if (Object.keys(changes).length === 0) return service.getTask(id);
        return service.updateTask(id, changes);
      }),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: 'Permanently delete a task. To complete a task, use update_task with status "done" instead.',
      inputSchema: z.object({ id }),
      annotations: destructive,
    },
    ({ id }) => run(() => service.deleteTask(id)),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Projects with their desired outcome, task counts per list, progress percentage, and whether they have a next action.",
      inputSchema: z.object({ status: projectFields.status.optional().describe("Omit for all projects") }),
      annotations: readOnly,
    },
    ({ status }) => run(() => service.findProjects(status)),
  );

  server.registerTool(
    "get_project",
    { title: "Get project", description: "One project with all of its tasks.", inputSchema: z.object({ id }), annotations: readOnly },
    ({ id }) => run(() => service.getProject(id)),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description: "Create a project (any outcome that needs more than one action). Define it by its desired outcome, and pass its first next actions so the project isn't stuck.",
      inputSchema: z.object({
        name: projectFields.name,
        outcome: projectFields.outcome.optional(),
        status: projectFields.status.default("active"),
        nextActions: z.array(z.string().trim().min(1).max(500)).max(20).default([]).describe('Titles of tasks to create in "next" for this project'),
      }),
      annotations: write,
    },
    ({ nextActions, ...project }) => run(() => service.createProject(project, nextActions)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Rename a project, change its desired outcome, or change its status (active, someday, done). Only the fields you pass change.",
      inputSchema: z.object({
        id,
        name: projectFields.name.optional(),
        outcome: projectFields.outcome.optional(),
        status: projectFields.status.optional(),
      }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ id, ...changes }) => run(() => (Object.keys(changes).length ? service.updateProject(id, changes) : service.getProject(id))),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Permanently delete a project. Its tasks are kept and detached from it. To finish a project, set its status to done instead.",
      inputSchema: z.object({ id }),
      annotations: destructive,
    },
    ({ id }) => run(() => service.deleteProject(id)),
  );

  server.registerPrompt(
    "weekly_review",
    {
      title: "Weekly review",
      description: "Walk through a GTD weekly review of this system step by step.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Let's do my GTD weekly review. Call gtd_overview first. Then, one step at a time and waiting for me between steps: 1) process the inbox item by item (next action, project, waiting, someday, or delete); 2) go over overdue and upcoming due dates; 3) for every active project without a next action, ask me for one; 4) review the waiting list for follow-ups; 5) skim someday for anything to activate. Make the changes with the tools as we agree on them.",
          },
        },
      ],
    }),
  );
}
