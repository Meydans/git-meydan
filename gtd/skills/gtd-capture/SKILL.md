---
name: gtd-capture
description: Turn free text into clarified tasks in the user's GTD app (the "gtd" MCP server). Use whenever the user wants to add, capture or note down things to do, in Hebrew or English ("תוסיף משימה", "תרשום לי", "צריך ל…", "תזכיר לי", a brain dump, meeting notes, a pasted list), or asks to break something into steps. Creates each item already processed (list, context, project, dates, subtasks) in as few tool calls as possible.
---

# GTD capture

Turn whatever the user wrote into tasks that are already clarified, so they don't have to process them again later. Work with the gtd MCP tools. Keep the user's language (usually Hebrew) in titles and notes.

## 1. Look before writing (once per conversation)

- `gtd_overview`: today's date (Asia/Jerusalem). Every relative date is computed from it.
- `list_projects` with `status: "active"`: names and outcomes, for matching items to projects.

Skip a call if its result is already in this conversation and nothing has changed since.

## 2. Split into items

One item per action or outcome. "להתקשר לרואה החשבון ולקנות נורות" is two items. Keep details that belong to an item (names, numbers, links, why) for its notes.

## 3. Decide where each item goes

Go down this list and stop at the first match:

| The item is… | Goes to |
| --- | --- |
| Reference or information only, nothing to do | Don't create a task. Say so in the summary. |
| An idea or "maybe one day" | `someday` |
| Stuck until someone else answers, delivers or decides (an advisor, a lawyer, a family member, a supplier) | `waiting`. Notes start with `ממתין ל: <who/what>`. `startDate` is the follow-up day: the date the user gave, otherwise 7 days from today. |
| One physical action that can be done now | `next`, with a context (section 5) |
| A single job with a few steps (an afternoon, not months) | A parent task in `next` with subtasks (`parentId`). Set `sequential: true` on the parent only when each step truly depends on the previous one. |
| An outcome that needs several actions over time | A project: an existing one if it clearly matches, otherwise a new one (section 6) |
| Too vague to decide from what was written | `inbox`, with the user's own wording. This is the fallback, not the default. |

A decision that depends on outside input is `waiting` on that input. If getting the input needs an action of ours (booking the meeting, sending the question), that action is the `next` task, and the decision is `waiting`.

## 4. Titles

- Start with a verb in the infinitive: "להתקשר ל…", "לשלוח…", "לקנות…", "לבדוק…".
- Make it concrete enough to do without thinking: "להתקשר לחברת החשמל לגבי החשבון של אלה", not "חשמל".
- Keep it short (about 60 characters). Everything else goes in `notes`.
- A checklist that isn't worth subtasks goes in notes as lines `- [ ] item`.

## 5. Context (required for `next` and for subtasks)

Infer it from the verb and the place:

| Context | When |
| --- | --- |
| `@phone` | calling, arranging, booking or asking by phone (להתקשר, לתאם, לקבוע תור, לברר טלפונית) |
| `@computer` | writing, email, research, documents, spreadsheets, online forms and purchases (לכתוב, לשלוח מייל, לבדוק באתר, למלא טופס, להזמין אונליין) |
| `@errand` | going out: buying, picking up, dropping off (לקנות, לאסוף, להחזיר, לקפוץ ל…) |
| `@home` | things done at home (לתקן, לסדר, לנקות, לצלם בבית) |

If two contexts fit, pick where the first physical step happens. Ask only if it's truly unclear. `waiting`, `someday` and `inbox` items may have no context.

## 6. Projects

- **Existing project:** assign `projectId` only when the item clearly belongs to one project, by its name or outcome. If two projects fit, ask with one short question.
- **New project:** create one only when the user describes an outcome with several steps. Call `create_project` with a name and an `outcome` ("what done looks like"), then add its tasks through `create_tasks` with `projectId`, so each task gets its context. Don't use `nextActions` for this, because it can't set contexts. A new project needs at least one `next` task.
- Mark a project `sequential` only when its steps must happen in order.

## 7. Dates

Compute from today in Asia/Jerusalem, as `YYYY-MM-DD`:

- "היום": today. "מחר": +1. "מחרתיים": +2.
- "ביום ראשון" and other weekdays: the next occurrence, never today.
- "בעוד שבוע": +7. "סוף השבוע": the coming Friday. "סוף החודש": the last day of the month.
- **`dueDate`** is only for a real deadline: "עד…", "לפני…", "הדדליין…", a fixed appointment or event.
- **`startDate`** is for "not before": "מ-…", "אחרי ש…", "לא לפני…", "בשבוע הבא" (for work that can't start yet), a day to do something that isn't a deadline ("מחר להתקשר…"), and follow-ups on waiting items.
- Never invent a due date. `startDate` must be on or before `dueDate`.
- For a fixed-time appointment, offer to put it in the calendar. If a calendar tool is available, follow the server's calendar instructions and embed the task's url.

## 8. Duplicates

Before creating an item, look for it with one `list_tasks` call per item, using `query` with its most distinctive word and `list: "open"`.

- If the same task already exists, don't create it again. Update it only if the new text adds something (a date, a context, notes), and say so.
- For many items at once, one `list_tasks` call with `list: "open"` and a high `limit`, scanned by eye, is cheaper.

## 9. Write with as few calls as possible

1. `create_project` for each new project, if any.
2. One `create_tasks` call with every top-level task (up to 50), each with its status, context, projectId, dates and notes set.
3. One more `create_tasks` call for all subtasks, using the parent ids from step 2. Subtasks are stored in `next` automatically, but still give each one a context.
4. If order matters in a sequential parent or project, create the tasks in order. Use `reorder_tasks` only if the order came out wrong.

Don't ask for confirmation first unless something in sections 3 or 6 was truly ambiguous. The user asked to add things; add them, then report.

## 10. Report back

A short summary:

- A compact table: title (linked to the task's `url`) | list | context | project | dates.
- One line for anything left in `inbox` and why, and anything not created (reference, duplicate).
- At most one follow-up question, if something needs the user's decision.

## Examples

**"צריך להתקשר מחר לרואה החשבון לגבי הדוח השנתי, לקנות נורות למרפסת, ולשאול את עו״ד כהן אם אפשר עסקה משולבת"**

- "להתקשר לרואה החשבון לגבי הדוח השנתי": `next`, `@phone`, startDate is tomorrow. "מחר" is when to do it, not a deadline.
- "לקנות נורות למרפסת": `next`, `@errand`.
- "לשלוח לעו״ד כהן שאלה: האם אפשרית עסקה משולבת": `next`, `@computer`. The answer becomes a `waiting` item once the question is sent. Offer that, don't create it yet.

**"לפצל את בדיקת שווי הדירה: לאתר מתווכים, לתאם פגישות, לקבל הערכות, להשוות"**

The parent task gets `sequential: true`, and each subtask gets a context: לאתר מתווכים (`@computer`), לתאם פגישות (`@phone`), לקבל הערכות (`@phone`), להשוות בין ההערכות (`@computer`).

**"רעיון: לעשות אלבום תמונות לסבתא ליום הולדת 80 בדצמבר"**

This is an outcome with several steps and a real deadline. Ask one question: a project now, or `someday`? If it's a project, set its outcome to "אלבום מוכן ונמסר לסבתא". Its first next action is "לאסוף תמונות מהמשפחה" (`@phone`), with a dueDate on the birthday only if the user gave the date.
