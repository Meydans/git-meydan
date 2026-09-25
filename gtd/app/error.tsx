"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="login">
      <h1>משהו השתבש</h1>
      <p>הפעולה לא נשמרה. בדוק שהשדות תקינים ונסה שוב.</p>
      <button className="primary" onClick={reset}>ניסיון חוזר</button>
    </main>
  );
}
