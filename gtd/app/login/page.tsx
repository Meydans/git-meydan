import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth/session";
import { safePath } from "@/lib/safe-path";

const messages: Record<string, string> = {
  denied: "החשבון הזה לא מורשה להיכנס.",
  failed: "הכניסה נכשלה. נסו שוב.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  const target = safePath(next);
  if (await getSessionEmail()) redirect(target);
  const message = typeof error === "string" ? messages[error] : undefined;
  return (
    <main className="login">
      <h1>GTD</h1>
      <form action="/api/auth/google">
        {target !== "/" && <input type="hidden" name="next" value={target} />}
        <button className="primary">כניסה עם Google</button>
      </form>
      {message && <p className="error">{message}</p>}
    </main>
  );
}
