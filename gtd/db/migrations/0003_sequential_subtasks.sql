ALTER TABLE "projects" ADD COLUMN "sequential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "position" double precision DEFAULT extract(epoch from clock_timestamp()) NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sequential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tasks_project_position_idx" ON "tasks" USING btree ("project_id","position");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_not_own_parent" CHECK ("tasks"."parent_id" is null or "tasks"."parent_id" <> "tasks"."id");--> statement-breakpoint
-- Existing tasks keep their creation order, with unique positions even where created_at ties
-- (rows inserted by one statement). New rows get epoch-based positions, which sort after these.
UPDATE "tasks" t SET "position" = o.rn FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "tasks"
) o WHERE o.id = t.id;--> statement-breakpoint
-- Hierarchy rules for every writer (UI, REST, MCP): one level of subtasks only, and a subtask
-- always lives in its parent's project.
CREATE OR REPLACE FUNCTION gtd_task_hierarchy() RETURNS trigger AS $$
DECLARE
  parent_row tasks%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent_row FROM tasks WHERE id = NEW.parent_id;
    IF FOUND THEN
      IF parent_row.parent_id IS NOT NULL THEN
        RAISE EXCEPTION 'subtasks can only be one level deep' USING ERRCODE = 'G0001';
      END IF;
      IF EXISTS (SELECT 1 FROM tasks WHERE parent_id = NEW.id) THEN
        RAISE EXCEPTION 'a task that has subtasks cannot become a subtask' USING ERRCODE = 'G0002';
      END IF;
      NEW.project_id := parent_row.project_id;
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER tasks_hierarchy BEFORE INSERT OR UPDATE OF parent_id, project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION gtd_task_hierarchy();--> statement-breakpoint
-- A parent carries its subtasks along: moving it moves them, completing it completes them.
CREATE OR REPLACE FUNCTION gtd_task_cascade() RETURNS trigger AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    UPDATE tasks SET project_id = NEW.project_id WHERE parent_id = NEW.id;
  END IF;
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    UPDATE tasks SET status = 'done', updated_at = now() WHERE parent_id = NEW.id AND status <> 'done';
  END IF;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER tasks_cascade AFTER UPDATE OF project_id, status ON tasks
  FOR EACH ROW WHEN (NEW.parent_id IS NULL) EXECUTE FUNCTION gtd_task_cascade();
