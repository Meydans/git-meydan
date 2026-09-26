-- Contexts by mode instead of by tool: a phone does calls, email and payments anywhere now,
-- so what limits a task is focus time, a few minutes, going out, or being at home.
-- Renaming keeps every existing value: @phone -> @quick, @computer -> @focus, @errand -> @out.
ALTER TYPE "public"."task_context" RENAME VALUE '@phone' TO '@quick';--> statement-breakpoint
ALTER TYPE "public"."task_context" RENAME VALUE '@computer' TO '@focus';--> statement-breakpoint
ALTER TYPE "public"."task_context" RENAME VALUE '@errand' TO '@out';
