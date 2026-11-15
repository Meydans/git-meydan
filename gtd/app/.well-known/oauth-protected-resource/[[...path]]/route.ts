import { getPublicOrigin } from "mcp-handler";
import { json, preflight } from "@/lib/cors";
import { mcpResource, SCOPE } from "@/lib/oauth";

// RFC 9728 metadata, served at both the root path and the path-suffixed form (/api/mcp).
export const GET = (request: Request) => {
  const origin = getPublicOrigin(request);
  return json({
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "GTD",
  });
};
export const OPTIONS = preflight;
