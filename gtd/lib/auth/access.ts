// Who may use what. Everyone on ALLOWED_EMAILS can sign in and use the finance module.
// Emails also listed in FINANCE_ONLY_EMAILS can use nothing else: GTD (tasks, projects, review,
// the REST API and the MCP authorization screen) is closed to them.
// Pure on purpose (no framework imports), so it can be unit-tested.
const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export function isFinanceOnly(email: string | null | undefined): boolean {
  if (!email) return false;
  return list(process.env.FINANCE_ONLY_EMAILS).includes(email.trim().toLowerCase());
}

export const canUseGtd = (email: string | null | undefined): boolean => !!email && !isFinanceOnly(email);
