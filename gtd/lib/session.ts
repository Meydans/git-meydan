// The web UI's session is a signed Google sign-in cookie (see lib/auth/). Pages and Server Actions
// import from here; proxy.ts is only an optimistic first check.
export {
  createSession,
  deleteSession as endSession,
  getGtdSessionEmail,
  getSessionEmail,
  requireFinanceSession,
  requireSession,
} from "./auth/session";
