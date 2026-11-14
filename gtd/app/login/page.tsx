import { redirect } from "next/navigation";
import { getSessionEmail } from "../../lib/auth/session";

const messages: Record<string, string> = {
  denied: "החשבון הזה לא מורשה להיכנס.",
  failed: "הכניסה נכשלה. נסו שוב.",
};

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (await getSessionEmail()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? messages[error] : undefined;

  return (
    <main className="card">
      <h1>משק הבית</h1>
      <p className="muted">כניסה למורשים בלבד.</p>
      {message && <p className="error">{message}</p>}
      <a className="button" href="/api/auth/google">
        כניסה עם Google
      </a>
    </main>
  );
}
