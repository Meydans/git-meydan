import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { authorizeKeys, checkAuthorizeRequest, consentToken, type AuthorizeParams } from "@/lib/oauth";
import { currentOrigin } from "@/lib/origin";
import { getSessionEmail } from "@/lib/session";
import { approve, deny } from "./actions";

export const metadata = { title: "GTD · אישור גישה" };

export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const sp = await searchParams;
  const params: AuthorizeParams = {};
  for (const key of authorizeKeys) {
    const value = sp[key];
    if (typeof value === "string") params[key] = value;
  }

  const check = sp.invalid ? ({ ok: false, show: "הבקשה אינה תקינה. התחל את החיבור מחדש." } as const) : await checkAuthorizeRequest(params, await currentOrigin());
  if (!check.ok) {
    if ("redirect" in check) redirect(check.redirect);
    return (
      <main className="login consent">
        <h1>GTD</h1>
        <p className="error">{check.show}</p>
      </main>
    );
  }

  const signedIn = !!(await getSessionEmail());
  const clientName = check.client.name ?? "אפליקציה חיצונית";
  const redirectHost = new URL(check.redirectUri).host;
  const hidden = (
    <>
      {authorizeKeys.map((key) => params[key] !== undefined && <input key={key} type="hidden" name={key} value={params[key]} />)}
      <input type="hidden" name="consent" value={consentToken(params)} />
    </>
  );

  return (
    <main className="login consent">
      <ShieldCheck size={40} className="consent-icon" />
      <h1>GTD</h1>
      <p className="consent-text">
        <strong>{clientName}</strong> מבקש גישה מלאה למשימות ולפרויקטים שלך: קריאה, יצירה, עריכה ומחיקה.
      </p>
      <p className="hint">אחרי האישור תועבר אל {redirectHost}</p>

      <form action={approve}>
        {hidden}
        <button className="primary" disabled={!signedIn}>אישור גישה</button>
      </form>
      {!signedIn && (
        <form action="/api/auth/google">
          <input type="hidden" name="next" value={`/oauth/authorize?${new URLSearchParams(params)}`} />
          <button className="primary">כניסה עם Google</button>
        </form>
      )}
      <form action={deny}>
        {hidden}
        <button className="deny">ביטול</button>
      </form>
    </main>
  );
}
