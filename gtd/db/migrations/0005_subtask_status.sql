-- A subtask is already clarified (it has a parent and a place in its order), so it never
-- sits in the inbox: a subtask created or moved there without a status lands in Next.
-- A trigger covers every writer (UI, REST, MCP), like the hierarchy rules in 0003.
CREATE OR REPLACE FUNCTION gtd_subtask_status() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.status = 'inbox' THEN
    NEW.status := 'next';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER gtd_subtask_status BEFORE INSERT OR UPDATE OF parent_id, status ON tasks
  FOR EACH ROW EXECUTE FUNCTION gtd_subtask_status();
--> statement-breakpoint
UPDATE tasks SET status = 'next' WHERE parent_id IS NOT NULL AND status = 'inbox';
