import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// The redirect target comes from config, never from request headers.
export const appUrl = () => env("APP_URL").replace(/\/+$/, "");
const redirectUri = () => `${appUrl()}/api/auth/callback`;

const b64url = (buf: Buffer) => buf.toString("base64url");

export function newChallenge() {
  const verifier = b64url(randomBytes(32));
  return {
    state: b64url(randomBytes(16)),
    nonce: b64url(randomBytes(16)),
    verifier,
    challenge: b64url(createHash("sha256").update(verifier).digest()),
  };
}

export function authorizeUrl(c: { state: string; nonce: string; challenge: string }) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email",
    state: c.state,
    nonce: c.nonce,
    code_challenge: c.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

// Exchanges the code and returns the verified email, or throws.
export async function emailFromCode(code: string, verifier: string, nonce: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google returned no id_token");

  const { payload } = await jwtVerify(id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env("GOOGLE_CLIENT_ID"),
  });
  if (payload.nonce !== nonce) throw new Error("Nonce mismatch");
  if (payload.email_verified !== true || typeof payload.email !== "string") {
    throw new Error("Google account has no verified email");
  }
  return payload.email;
}
