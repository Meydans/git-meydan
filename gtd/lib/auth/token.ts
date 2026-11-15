import { SignJWT, jwtVerify } from "jose";
import { isAllowed } from "./allowlist";

// No "server-only" here: the proxy and route handlers both import this file.
export const SESSION_COOKIE = "gtd_session";
export const OAUTH_COOKIE = "gtd_oauth";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_SECONDS = 10 * 60;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

async function sign(kind: "session" | "oauth", claims: Record<string, string>, seconds: number) {
  return new SignJWT({ ...claims, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(key());
}

async function verify(kind: "session" | "oauth", token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.kind === kind ? payload : null;
  } catch {
    return null;
  }
}

export const signSession = (email: string) => sign("session", { email }, SESSION_SECONDS);

// Returns the email only while it is still on the allowlist, so removing an address revokes its sessions.
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  const payload = await verify("session", token);
  const email = payload?.email;
  return typeof email === "string" && isAllowed(email) ? email : null;
}

export const signOAuthState = (claims: { state: string; verifier: string; nonce: string; next?: string }) =>
  sign("oauth", claims, OAUTH_SECONDS);

export async function verifyOAuthState(token: string | undefined) {
  const payload = await verify("oauth", token);
  if (!payload) return null;
  const { state, verifier, nonce, next } = payload;
  return typeof state === "string" && typeof verifier === "string" && typeof nonce === "string"
    ? { state, verifier, nonce, next: typeof next === "string" ? next : "/" }
    : null;
}
