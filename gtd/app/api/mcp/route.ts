import { createHash, timingSafeEqual } from "node:crypto";
import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { instructions, registerTools } from "@/lib/mcp-tools";
import { SCOPE, verifyAccessToken } from "@/lib/oauth";

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "gtd", version: "1.0.0" },
  instructions,
});

const sha256 = (value: string) => createHash("sha256").update(value).digest();

// Accepts an OAuth access token (claude.ai, Claude Desktop) or the static API_TOKEN (Claude Code, scripts).
async function verify(request: Request, token?: string) {
  if (!token) return undefined;
  const apiToken = process.env.API_TOKEN;
  if (apiToken && timingSafeEqual(sha256(token), sha256(apiToken))) {
    return { token, clientId: "api-token", scopes: [SCOPE] };
  }
  return verifyAccessToken(token, getPublicOrigin(request));
}

const handler = withMcpAuth(mcp, verify, {
  required: true,
  requiredScopes: [SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { handler as GET, handler as POST, handler as DELETE };
