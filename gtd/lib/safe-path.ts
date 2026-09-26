// A same-site path only ("/tasks/x?y"), so a crafted link can't send the user to another site after login.
export function safePath(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
