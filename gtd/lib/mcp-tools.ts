import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { projectStatus, taskContext, taskStatus } from "@/db/schema";
import { appOrigin, withLinks } from "@/lib/links";
import { lists } from "@/lib/lists";
import { taskRuleMessage } from "@/lib/pg";
import { markProjectReviewed, reviewQueue } from "@/lib/review";
import * as service from "@/lib/service";

const id = z.uuid();
const status = z.enum(taskStatus.enumValues);
const context = z.enum(taskContext.enumValues);
const dueDate = z.iso.date().describe("Calendar date, YYYY-MM-DD, in the user's timezone (Asia/Jerusalem)");
const startDate = z.iso
  .date()
  .describe("Start (defer) date, YYYY-MM-DD. The task stays hidden from its list until this day; must be on or before dueDate. null = available now");

const taskFields = {
  title: z.string().trim().min(1).max(500),
  status: status.describe("inbox = captured, not yet clarified; next = the next physical action; waiting = delegated or blocked on someone; someday = maybe later; done = completed"),
  context: context.nullable().describe("Where or with what the action can be done. null clears it"),
  projectId: id.nullable().describe("Project this task belongs to. null detaches it. A subtask always takes its parent's project"),
  parentId: id
    .nullable()
    .describe("Make this a subtask of another task (one level only: the parent can't itself be a subtask, and a task with subtasks can't become one). null makes it top-level"),
  sequential: z.boolean().describe("For a parent task: its subtasks must be done in order, and only the first open one is actionable"),
  startDate: startDate.nullable(),
  dueDate: dueDate.nullable(),
  notes: z.string().max(10_000).nullable().describe('Free text. Lines like "- [ ] item" render as a checklist in the app'),
};

const projectFields = {
  name: z.string().trim().min(1).max(200),
  outcome: z.string().max(2000).nullable().describe("The desired outcome: what 'done' looks like for this project"),
  status: z.enum(projectStatus.enumValues),
  sequential: z.boolean().describe("Tasks must be done in order: only the first open top-level task is actionable and shows in Next"),
  reviewCadenceDays: z.number().int().min(1).max(365).describe("How often the project should be reviewed, in days (default 7)"),
};

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Tool results are JSON text with a `url` on every task and project; a missing row
// becomes a tool error the model can react to.
async function run(ctx: ServerContext, fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = withLinks(await fn(), appOrigin(ctx.http?.req));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 1) }] };
  } catch (error) {
    if (error instanceof service.NotFound) return { content: [{ type: "text", text: error.message }], isError: true };
    if (error instanceof service.InvalidRequest) return { content: [{ type: "text", text: error.message }], isError: true };
    const rule = taskRuleMessage(error);
    if (rule) return { content: [{ type: "text", text: rule }], isError: true };
    throw error;
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const destructive = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export const instructions = `This server is the user's personal GTD (Getting Things Done) system. Task and project text is usually Hebrew; keep the user's language when creating or editing items.
Lists: inbox (captured, unprocessed), next (next physical actions), waiting (waiting on someone), someday (maybe later), done. "scheduled" is a view of open tasks that have a due date.
Contexts: @phone, @computer, @errand, @home. Every active project should have at least one task in "next".
Start dates: a task may have a startDate (defer date). Until that day it is hidden from its list (and from counts) and appears only in "deferred" and, if it has a due date, in "scheduled". On the start date it comes back to its list by itself. Use it for "not before" dates and tickler-style follow-ups (e.g. a waiting item to chase next week). startDate must be on or before dueDate.
Start with gtd_overview to see today's date, counts, overdue items and stuck projects. New thoughts go to the inbox unless the user says otherwise.
Hierarchy: project -> task -> subtasks (one level; notes checklists are a lighter level below that). Lists show top-level tasks; subtasks come nested under their parent. Break a bigger task into subtasks with create_tasks (parentId).
Sequential: a project or a parent task can be sequential. Then tasks are done in manual order (reorder_tasks): only the first open one is actionable and appears in Next; later ones are "blocked" until it's done. Mark something sequential when steps truly depend on each other.
Project reviews: every active project has a review cadence (days). review_queue lists projects due for review or stalled (active with no available next action); after going over one with the user, call mark_project_reviewed. Project statuses: active, someday (on hold), done (completed), dropped (abandoned, kept in history; its tasks leave the working lists). Review status is metadata only: never create tasks or calendar events for reviews.
Every task and project in tool results has a "url": its canonical link, which opens it directly in the app (on the user's phone it opens the installed app).
Calendar events: whenever you create, update or sync a calendar event for a task (with any calendar tool), always embed that task's url. Put it on its own line at the start of the event description (e.g. "משימה ב-GTD: <url>"), and also set it as the event's location or URL field when the calendar tool has one. Use the task title as the event title. For an event covering several tasks, list each task's url. If the event fixes when the task will be done and the task has no due date, offer to set dueDate to the event's date.`;

export function registerTools(server: McpServer) {
  server.registerTool(
    "gtd_overview",
    {
      title: "GTD overview",
      description: "Snapshot of the whole system: today's date, how many available tasks are in each list (plus how many are deferred), overdue and due-today tasks, tasks whose start date is today, inbox items waiting to be processed, stalled active projects (no available next action), and the project review queue. Use first, and for daily or weekly reviews.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    (_args, ctx) => run(ctx, () => service.overview()),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks in one GTD list, optionally filtered by context, project or a text search over title and notes. Without a list, returns all open (not done) tasks. Tasks with a future start date are left out unless includeDeferred is true or list is \"deferred\". Lists hold top-level tasks; a parent carries its subtasks in \"subtasks\" (with a blocked flag each).",
      inputSchema: z.object({
        list: z
          .enum([...lists, "open"])
          .default("open")
          .describe('A GTD list, "scheduled" (open tasks with a due date), "deferred" (open tasks whose start date is in the future), or "open" (every task not done)'),
        context: context.optional(),
        projectId: id.optional(),
        query: z.string().trim().min(1).max(200).optional().describe("Case-insensitive substring match on title and notes"),
        limit: z.number().int().min(1).max(200).default(50),
        includeDeferred: z.boolean().default(false).describe("Also include tasks whose start date hasn't arrived yet (hidden from lists by default)"),
        includeBlocked: z
          .boolean()
          .default(false)
          .describe("Also include Next tasks held back because an earlier task in their sequential project comes first (hidden by default)"),
      }),
      annotations: readOnly,
    },
    ({ list, context, projectId, query, limit, includeDeferred, includeBlocked }, ctx) =>
      run(ctx, () => service.findTasks(list, { context, projectId, q: query, includeDeferred, includeBlocked }, limit)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Full details of one task: notes, its subtasks (in order, with blocked flags), and whether it is blocked by an earlier task in a sequential project or parent (blockedBy).",
      inputSchema: z.object({ id }),
      annotations: readOnly,
    },
    ({ id }, ctx) => run(ctx, () => service.getTask(id)),
  );

  server.registerTool(
    "create_tasks",
    {
      title: "Create tasks",
      description: "Create one or more tasks. Status defaults to inbox, which is right for quick capture; set status, context, project, start date and due date when the user has already clarified the item. Use startDate for things that can't or shouldn't be done before a certain day.",
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              title: taskFields.title,
              status: taskFields.status.default("inbox"),
              context: taskFields.context.optional(),
              projectId: taskFields.projectId.optional(),
              parentId: taskFields.parentId.optional(),
              sequential: taskFields.sequential.optional(),
              startDate: taskFields.startDate.optional(),
              dueDate: taskFields.dueDate.optional(),
              notes: taskFields.notes.optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
      annotations: write,
    },
    ({ tasks }, ctx) => run(ctx, () => service.createTasks(tasks)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: 'Change any fields of a task: move it between lists (e.g. status "done" to complete it), set or clear its context, project, parent, start date, due date or notes, make its subtasks sequential, or rename it. Completing a parent (status "done") also completes its open subtasks. Only the fields you pass change; pass null to clear an optional field.',
      inputSchema: z.object({
        id,
        title: taskFields.title.optional(),
        status: taskFields.status.optional(),
        context: taskFields.context.optional(),
        projectId: taskFields.projectId.optional(),
        parentId: taskFields.parentId.optional(),
        sequential: taskFields.sequential.optional(),
        startDate: taskFields.startDate.optional(),
        dueDate: taskFields.dueDate.optional(),
        notes: taskFields.notes.optional(),
      }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ id, ...changes }, ctx) =>
      run(ctx, async () => {
        if (Object.keys(changes).length === 0) return service.getTask(id);
        return service.updateTask(id, changes);
      }),
  );

  server.registerTool(
    "reorder_tasks",
    {
      title: "Reorder tasks",
      description: "Put tasks in a new manual order. Pass sibling ids in the order you want: subtasks of one parent, or top-level tasks of one project. Other tasks keep their place. In a sequential project or parent the first open task is the actionable one.",
      inputSchema: z.object({ ids: z.array(id).min(2).max(200) }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ ids }, ctx) => run(ctx, () => service.reorderTasks(ids)),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: 'Permanently delete a task (and its subtasks). To complete a task, use update_task with status "done" instead.',
      inputSchema: z.object({ id }),
      annotations: destructive,
    },
    ({ id }, ctx) => run(ctx, () => service.deleteTask(id)),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Projects with their desired outcome, task counts per list, progress percentage, and review health: isStalled (active with no available next action), isDueForReview, needsReview, daysSinceReview, nextReviewAt, reviewCadenceDays.",
      inputSchema: z.object({ status: projectFields.status.optional().describe("Omit for all projects") }),
      annotations: readOnly,
    },
    ({ status }, ctx) => run(ctx, () => service.findProjects(status)),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "One project with its top-level tasks in manual order (each with its subtasks and a blocked flag when the project is sequential).",
      inputSchema: z.object({ id }),
      annotations: readOnly,
    },
    ({ id }, ctx) => run(ctx, () => service.getProject(id)),
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
        sequential: projectFields.sequential.default(false),
        reviewCadenceDays: projectFields.reviewCadenceDays.optional(),
        nextActions: z.array(z.string().trim().min(1).max(500)).max(20).default([]).describe('Titles of tasks to create in "next" for this project'),
      }),
      annotations: write,
    },
    ({ nextActions, ...project }, ctx) => run(ctx, () => service.createProject(project, nextActions)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Rename a project, change its desired outcome, its review cadence, or its status (active, someday = on hold, done = completed, dropped = abandoned but kept in history). Only the fields you pass change.",
      inputSchema: z.object({
        id,
        name: projectFields.name.optional(),
        outcome: projectFields.outcome.optional(),
        status: projectFields.status.optional(),
        sequential: projectFields.sequential.optional(),
        reviewCadenceDays: projectFields.reviewCadenceDays.optional(),
      }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ id, ...changes }, ctx) => run(ctx, () => (Object.keys(changes).length ? service.updateProject(id, changes) : service.getProject(id))),
  );

  server.registerTool(
    "review_queue",
    {
      title: "Project review queue",
      description: "Active projects that need a review now: due by their review cadence, or stalled (no available next action) since their last review. Each comes with its open tasks. Use for weekly reviews; review metadata never appears in the daily task lists.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    (_args, ctx) =>
      run(ctx, async () => {
        const queue = await reviewQueue();
        return Promise.all(queue.map(async (p) => ({ ...p, openTasks: (await service.getProject(p.id)).tasks.filter((t) => t.status !== "done") })));
      }),
  );

  server.registerTool(
    "mark_project_reviewed",
    {
      title: "Mark project reviewed",
      description: "Record that a project was reviewed now: it leaves the review queue until its cadence comes around again. If it's stalled at this moment, the stall counts as acknowledged until then. Make sure it has a next action (or a deliberate status) first.",
      inputSchema: z.object({ id }),
      annotations: { ...write, idempotentHint: true },
    },
    ({ id }, ctx) =>
      run(ctx, async () => {
        const project = await markProjectReviewed(id);
        if (!project) throw new service.NotFound(`Project ${id} not found`);
        return project;
      }),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Permanently delete a project. Its tasks are kept and detached from it. To finish a project, set its status to done instead.",
      inputSchema: z.object({ id }),
      annotations: destructive,
    },
    ({ id }, ctx) => run(ctx, () => service.deleteProject(id)),
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
            text: "Let's do my GTD weekly review. Call gtd_overview first. Then, one step at a time and waiting for me between steps: 1) process the inbox item by item (next action, project, waiting, someday, or delete); 2) go over overdue and upcoming due dates; 3) go through review_queue project by project: make sure each has a next action (ask me for one, or change its status: someday, done, or dropped), then mark_project_reviewed; 4) review the waiting list for follow-ups; 5) skim someday for anything to activate. Make the changes with the tools as we agree on them.",
          },
        },
      ],
    }),
  );
}
