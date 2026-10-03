ALTER TABLE "tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- completed_at follows the status for every writer (UI, REST, MCP, the parent cascade): set when a
-- task becomes done, cleared when it's reopened.
CREATE OR REPLACE FUNCTION gtd_completed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'done' THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'done' THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER gtd_completed_at BEFORE INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION gtd_completed_at();
--> statement-breakpoint
-- Tasks done before this migration: their last update is the best guess.
UPDATE tasks SET completed_at = updated_at WHERE status = 'done';
