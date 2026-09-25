import { getPublicOrigin } from "mcp-handler";
import { json, preflight } from "@/lib/cors";
import { authorizationServerMetadata } from "@/lib/oauth";

export const GET = (request: Request) => json(authorizationServerMetadata(getPublicOrigin(request)));
export const OPTIONS = preflight;
