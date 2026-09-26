import { login } from "@/app/actions";
import { safePath } from "@/lib/safe-path";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  return (
    <main className="login">
      <h1>GTD</h1>
      <form action={login}>
        <input type="hidden" name="next" value={safePath(next)} />
        <input type="password" name="password" placeholder="סיסמה" required autoFocus />
        <button className="primary">כניסה</button>
      </form>
      {error && <p className="error">סיסמה שגויה</p>}
    </main>
  );
}
