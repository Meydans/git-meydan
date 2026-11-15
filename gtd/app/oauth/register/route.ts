import { json, preflight } from "@/lib/cors";
import { OAuthFailure, registerClient } from "@/lib/oauth";

// RFC 7591 Dynamic Client Registration. Registering grants nothing by itself:
// every authorization still needs the owner's password and consent.
export async function POST(request: Request) {
  try {
    return json(await registerClient(await request.json()), 201);
  } catch (error) {
    if (error instanceof OAuthFailure) return json({ error: error.code, error_description: error.description }, error.status);
    if (error instanceof SyntaxError) return json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, 400);
    throw error;
  }
}
export const OPTIONS = preflight;
