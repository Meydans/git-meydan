import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canUseGtd } from "./access";
import { SESSION_COOKIE, SESSION_SECONDS, signSession, verifySessionToken } from "./token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function createSession(email: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(email), {
    ...cookieOptions,
    maxAge: SESSION_SECONDS,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// The signed-in email, or null.
export const getSessionEmail = cache(async () =>
  verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value),
);

// The signed-in email if it may use GTD, else null. For route handlers that answer 401/403 themselves.
export async function getGtdSessionEmail() {
  const email = await getSessionEmail();
  return canUseGtd(email) ? email : null;
}

// GTD pages and Server Actions. Default-deny: a finance-only account is sent to /finance, so any
// GTD entry point that calls this stays closed to it. The proxy is only an optimistic check.
export async function requireSession() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  if (!canUseGtd(email)) redirect("/finance");
  return email;
}

// Finance pages and actions: any signed-in, allowlisted account.
export async function requireFinanceSession() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  return email;
}
