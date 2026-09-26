// Postgres error codes surfaced through Drizzle (the driver error is the `cause`).
export const PG_FOREIGN_KEY = "23503";
export const PG_CHECK = "23514";

export const pgErrorCode = (error: unknown) => (error as { cause?: { code?: string } })?.cause?.code;

export const DATE_ORDER_MESSAGE = "startDate must be on or before dueDate";
