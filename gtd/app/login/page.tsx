import { login } from "@/app/actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <h1>GTD</h1>
      <form action={login}>
        <input type="password" name="password" placeholder="סיסמה" required autoFocus />
        <button className="primary">כניסה</button>
      </form>
      {error && <p className="error">סיסמה שגויה</p>}
    </main>
  );
}
