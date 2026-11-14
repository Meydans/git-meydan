import { NextResponse } from "next/server";
import { authorizeUrl, newChallenge } from "../../../../lib/auth/google";
import { OAUTH_COOKIE, OAUTH_SECONDS, signOAuthState } from "../../../../lib/auth/token";

export async function GET() {
  const c = newChallenge();
  const res = NextResponse.redirect(authorizeUrl(c));
  res.cookies.set(OAUTH_COOKIE, await signOAuthState(c), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: OAUTH_SECONDS,
  });
  return res;
}
