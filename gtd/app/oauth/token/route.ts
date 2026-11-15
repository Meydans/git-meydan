import { json, preflight } from "@/lib/cors";
import { exchangeCode, OAuthFailure, refreshTokens } from "@/lib/oauth";

async function readForm(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await request.json();
    return Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

export async function POST(request: Request) {
  try {
    const form = await readForm(request);
    if (form.grant_type === "authorization_code") return json(await exchangeCode(form));
    if (form.grant_type === "refresh_token") return json(await refreshTokens(form));
    throw new OAuthFailure("unsupported_grant_type", "Supported: authorization_code, refresh_token");
  } catch (error) {
    if (error instanceof OAuthFailure) return json({ error: error.code, error_description: error.description }, error.status);
    if (error instanceof SyntaxError) return json({ error: "invalid_request", error_description: "Malformed body" }, 400);
    throw error;
  }
}
export const OPTIONS = preflight;
