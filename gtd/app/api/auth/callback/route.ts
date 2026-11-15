import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safePath } from "../../../../lib/safe-path";
import { isAllowed } from "../../../../lib/auth/allowlist";
import { appUrl, emailFromCode } from "../../../../lib/auth/google";
import { createSession } from "../../../../lib/auth/session";
import { OAUTH_COOKIE, verifyOAuthState } from "../../../../lib/auth/token";

const back = (error: string) => NextResponse.redirect(`${appUrl()}/login?error=${error}`);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const store = await cookies();
  const saved = await verifyOAuthState(store.get(OAUTH_COOKIE)?.value);
  store.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  const code = params.get("code");
  if (params.get("error") || !code || !saved || params.get("state") !== saved.state) {
    return back("failed");
  }

  let email: string;
  try {
    email = await emailFromCode(code, saved.verifier, saved.nonce);
  } catch (error) {
    console.error(error);
    return back("failed");
  }
  if (!isAllowed(email)) return back("denied");

  await createSession(email);
  return NextResponse.redirect(`${appUrl()}${safePath(saved.next)}`);
}
