import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "gtd_session";

// The cookie holds an HMAC derived from APP_PASSWORD, so changing the password logs every session out.
function expectedSession() {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not configured");
  return createHmac("sha256", password).update("gtd-session-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function isValidSession(value: string | undefined) {
  return !!value && safeEqual(value, expectedSession());
}

export function checkPassword(password: string) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not configured");
  return safeEqual(
    createHmac("sha256", "gtd-login").update(password).digest("hex"),
    createHmac("sha256", "gtd-login").update(expected).digest("hex"),
  );
}

export async function startSession() {
  (await cookies()).set(SESSION_COOKIE, expectedSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// Every page and Server Action calls this; proxy.ts is only a first line of defense.
export async function requireSession() {
  if (!isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
}
