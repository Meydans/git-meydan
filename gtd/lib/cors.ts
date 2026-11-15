// OAuth metadata, registration and token endpoints are called from browser-based MCP clients too.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: corsHeaders });

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
