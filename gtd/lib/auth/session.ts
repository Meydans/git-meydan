import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

// Use in pages and route handlers: the proxy is only an optimistic check.
export async function requireSession() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  return email;
}
