// Postgres error codes surfaced through Drizzle (the driver error is the `cause`).
export const PG_FOREIGN_KEY = "23503";
export const PG_CHECK = "23514";

export const pgErrorCode = (error: unknown) => (error as { cause?: { code?: string } })?.cause?.code;

export const DATE_ORDER_MESSAGE = "startDate must be on or before dueDate";

// Raised by the tasks_hierarchy trigger (migration 0003).
export const PG_NESTED_SUBTASK = "G0001";
export const PG_PARENT_HAS_SUBTASKS = "G0002";

// A client-facing message for the constraint and trigger errors every writer can hit, or null.
export function taskRuleMessage(error: unknown) {
  switch (pgErrorCode(error)) {
    case PG_CHECK:
      return (error as { cause?: { constraint_name?: string } }).cause?.constraint_name === "tasks_not_own_parent"
        ? "A task cannot be its own parent"
        : DATE_ORDER_MESSAGE;
    case PG_NESTED_SUBTASK:
      return "Subtasks can only be one level deep: the parent is itself a subtask";
    case PG_PARENT_HAS_SUBTASKS:
      return "A task that has subtasks cannot become a subtask";
    case PG_FOREIGN_KEY:
      return "projectId or parentId does not reference an existing item";
    default:
      return null;
  }
}

// A short code for the same errors, for passing back to a form in the URL (?rule=...).
export function taskRuleCode(error: unknown): "dates" | "self" | "nested" | "has-subtasks" | null {
  switch (pgErrorCode(error)) {
    case PG_CHECK:
      return (error as { cause?: { constraint_name?: string } }).cause?.constraint_name === "tasks_not_own_parent" ? "self" : "dates";
    case PG_NESTED_SUBTASK:
      return "nested";
    case PG_PARENT_HAS_SUBTASKS:
      return "has-subtasks";
    default:
      return null;
  }
}
