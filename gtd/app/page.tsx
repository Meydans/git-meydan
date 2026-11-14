import { requireSession } from "../lib/auth/session";

export default async function Home() {
  const email = await requireSession();

  return (
    <main className="card">
      <h1>משק הבית</h1>
      <p className="muted">מחוברים כ-{email}</p>
      <form action="/api/auth/logout" method="post">
        <button className="button ghost" type="submit">
          יציאה
        </button>
      </form>
    </main>
  );
}
