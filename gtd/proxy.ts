import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

// Sends signed-out visitors to /login. The API, MCP and OAuth endpoints handle their own auth.
export function proxy(request: NextRequest) {
  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|login|oauth|\\.well-known|_next/static|_next/image|favicon.ico).*)"],
};
