import { asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, type Task } from "@/db/schema";
import { createTask } from "@/app/actions";
import { Nav } from "@/components/nav";
import { TaskItem } from "@/components/task-item";
import { taskStatusLabels, todayInIsrael } from "@/lib/labels";
import { requireSession } from "@/lib/session";

const openStatuses = ["inbox", "next", "waiting", "someday"] as const;

export default async function Home() {
  await requireSession();

  const [openTasks, doneTasks, allProjects] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(ne(tasks.status, "done"))
      .orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt)),
    db.select().from(tasks).where(eq(tasks.status, "done")).orderBy(desc(tasks.updatedAt)).limit(30),
    db.select().from(projects).orderBy(asc(projects.name)),
  ]);
  const today = todayInIsrael();
  const byStatus = (status: Task["status"]) => openTasks.filter((t) => t.status === status);

  return (
    <main>
      <Nav current="tasks" />

      <form action={createTask} className="capture">
        <input name="title" placeholder="מה על הראש? (נכנס לתיבת האיסוף)" required autoFocus />
        <button className="primary">הוספה</button>
      </form>

      {openStatuses.map((status) => {
        const list = byStatus(status);
        return (
          <section key={status} className="group">
            <h2>
              {taskStatusLabels[status]} <span className="count">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="empty">אין משימות</p>
            ) : (
              <ul className="tasks">
                {list.map((task) => (
                  <TaskItem key={task.id} task={task} projects={allProjects} today={today} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <details className="group done-group">
        <summary>
          <h2>
            {taskStatusLabels.done} <span className="count">{doneTasks.length}</span>
          </h2>
        </summary>
        <ul className="tasks">
          {doneTasks.map((task) => (
            <TaskItem key={task.id} task={task} projects={allProjects} today={today} />
          ))}
        </ul>
      </details>
    </main>
  );
}
