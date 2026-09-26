import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

// Sends signed-out visitors to /login, remembering where they were going (e.g. a task link
// opened from a calendar event). The API, MCP and OAuth endpoints handle their own auth.
export function proxy(request: NextRequest) {
  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const login = new URL("/login", request.url);
    const { pathname, search } = request.nextUrl;
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/((?!api|login|oauth|\\.well-known|_next/static|_next/image|manifest.webmanifest|sw.js|icons/|icon.svg|apple-icon.png|offline).*)"],
};
