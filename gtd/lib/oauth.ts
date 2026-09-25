import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { oauthClients, oauthCodes, oauthTokens } from "@/db/schema";

export const SCOPE = "gtd";
const CODE_TTL_S = 10 * 60;
const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 90 * 24 * 60 * 60;

export class OAuthFailure extends Error {
  constructor(
    public code: string,
    public description: string,
    public status = 400,
  ) {
    super(description);
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newSecret = () => randomBytes(32).toString("base64url");
const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

function appPassword() {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not configured");
  return password;
}

// Ties tokens to the current APP_PASSWORD: rotating the password revokes them all.
const secretVersion = () => createHmac("sha256", appPassword()).update("gtd-oauth-v1").digest("hex").slice(0, 16);

export const mcpResource = (origin: string) => `${origin}/api/mcp`;

// ---------- Clients ----------

export type OAuthClient = { id: string; name: string | null; redirectUris: string[] };

// https anywhere; plain http only for loopback redirects used by desktop/CLI clients.
const redirectUri = z.url().refine((value) => {
  const url = new URL(value);
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}, "redirect_uri must be https (or http on a loopback address)");

const registration = z.object({
  redirect_uris: z.array(redirectUri).min(1).max(10),
  client_name: z.string().trim().max(200).optional(),
});

export async function registerClient(body: unknown) {
  const parsed = registration.safeParse(body);
  if (!parsed.success) throw new OAuthFailure("invalid_client_metadata", parsed.error.issues[0].message);
  const id = randomBytes(16).toString("hex");
  const [client] = await db
    .insert(oauthClients)
    .values({ id, name: parsed.data.client_name ?? null, redirectUris: parsed.data.redirect_uris })
    .returning();
  return {
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.name ?? undefined,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

const metadataDocument = z.object({
  client_id: z.string(),
  client_name: z.string().max(200).optional(),
  redirect_uris: z.array(redirectUri).min(1),
});

// Client ID Metadata Documents: the client_id is an https URL serving the client's metadata.
async function fetchClientMetadata(clientId: string): Promise<OAuthClient | null> {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  const ipLiteral = /^[\d.]+$|^\[.*\]$/.test(url.hostname);
  if (url.protocol !== "https:" || url.pathname === "/" || url.hash || ipLiteral || url.hostname === "localhost") return null;

  try {
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
    const text = await res.text();
    if (!res.ok || text.length > 64 * 1024) return null;
    const doc = metadataDocument.safeParse(JSON.parse(text));
    if (!doc.success || doc.data.client_id !== clientId) return null;
    return { id: clientId, name: doc.data.client_name ?? null, redirectUris: doc.data.redirect_uris };
  } catch {
    return null;
  }
}

export async function resolveClient(clientId: string): Promise<OAuthClient | null> {
  if (clientId.startsWith("https://")) return fetchClientMetadata(clientId);
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  return client ? { id: client.id, name: client.name, redirectUris: client.redirectUris } : null;
}

// ---------- Authorization requests ----------

export const authorizeKeys = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;
export type AuthorizeParams = Partial<Record<(typeof authorizeKeys)[number], string>>;

export function withParams(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  return url.toString();
}

export type AuthorizeCheck =
  // Can't trust the redirect_uri: show the error on our own page, never redirect.
  | { ok: false; show: string }
  // redirect_uri is trusted: report the error back to the client.
  | { ok: false; redirect: string }
  | { ok: true; client: OAuthClient; redirectUri: string; resource: string; scope: string; params: AuthorizeParams };

export async function checkAuthorizeRequest(params: AuthorizeParams, origin: string): Promise<AuthorizeCheck> {
  if (!params.client_id || !params.redirect_uri) return { ok: false, show: "חסרים client_id או redirect_uri" };
  const client = await resolveClient(params.client_id);
  if (!client) return { ok: false, show: "האפליקציה המבקשת אינה מוכרת" };
  if (!client.redirectUris.includes(params.redirect_uri)) return { ok: false, show: "כתובת החזרה אינה רשומה לאפליקציה הזו" };

  const fail = (error: string, description: string) => ({
    ok: false as const,
    redirect: withParams(params.redirect_uri!, { error, error_description: description, state: params.state, iss: origin }),
  });
  if (params.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  if (params.code_challenge_method !== "S256" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(params.code_challenge ?? "")) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  const resource = params.resource ?? mcpResource(origin);
  if (resource.replace(/\/$/, "") !== mcpResource(origin)) return fail("invalid_target", "Unknown resource");
  const requested = (params.scope ?? SCOPE).split(" ").filter(Boolean);
  if (requested.some((s) => s !== SCOPE)) return fail("invalid_scope", `Supported scope: ${SCOPE}`);

  return { ok: true, client, redirectUri: params.redirect_uri, resource: mcpResource(origin), scope: SCOPE, params };
}

// Binds the consent form to the exact request it was rendered for.
export function consentToken(params: AuthorizeParams) {
  const payload = authorizeKeys.map((key) => params[key] ?? "").join("\n");
  return createHmac("sha256", appPassword()).update(`gtd-consent-v1\n${payload}`).digest("hex");
}

export function checkConsentToken(params: AuthorizeParams, token: string) {
  const expected = Buffer.from(consentToken(params));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function issueCode(check: Extract<AuthorizeCheck, { ok: true }>) {
  const code = newSecret();
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: check.client.id,
    redirectUri: check.redirectUri,
    codeChallenge: check.params.code_challenge!,
    resource: check.resource,
    scope: check.scope,
    expiresAt: inSeconds(CODE_TTL_S),
  });
  return code;
}

// ---------- Tokens ----------

async function issueTokens(clientId: string, resource: string, scope: string) {
  const now = new Date();
  await Promise.all([
    db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now)),
    db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now)),
  ]);
  const access = newSecret();
  const refresh = newSecret();
  const common = { clientId, resource, scope, secretVersion: secretVersion() };
  await db.insert(oauthTokens).values([
    { ...common, tokenHash: sha256(access), kind: "access", expiresAt: inSeconds(ACCESS_TTL_S) },
    { ...common, tokenHash: sha256(refresh), kind: "refresh", expiresAt: inSeconds(REFRESH_TTL_S) },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope };
}

const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export async function exchangeCode(form: Record<string, string>) {
  const { code, code_verifier: verifier, client_id: clientId, redirect_uri: redirect } = form;
  if (!code || !verifier || !clientId || !redirect) throw new OAuthFailure("invalid_request", "code, code_verifier, client_id and redirect_uri are required");

  // Deleting on read makes each code single-use even under concurrent requests.
  const [row] = await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, sha256(code))).returning();
  if (!row || row.expiresAt < new Date()) throw new OAuthFailure("invalid_grant", "Authorization code is invalid or expired");
  if (row.clientId !== clientId || row.redirectUri !== redirect) throw new OAuthFailure("invalid_grant", "Code was issued to a different client");
  if (pkceChallenge(verifier) !== row.codeChallenge) throw new OAuthFailure("invalid_grant", "PKCE verification failed");
  if (form.resource && form.resource.replace(/\/$/, "") !== row.resource) throw new OAuthFailure("invalid_target", "Resource does not match the authorization");
  return issueTokens(row.clientId, row.resource, row.scope);
}

export async function refreshTokens(form: Record<string, string>) {
  const { refresh_token: token, client_id: clientId } = form;
  if (!token) throw new OAuthFailure("invalid_request", "refresh_token is required");

  // Refresh tokens rotate: the presented one is consumed and a new pair is issued.
  const [row] = await db
    .delete(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, sha256(token)), eq(oauthTokens.kind, "refresh")))
    .returning();
  if (!row || row.expiresAt < new Date() || row.secretVersion !== secretVersion()) {
    throw new OAuthFailure("invalid_grant", "Refresh token is invalid or expired");
  }
  if (clientId && clientId !== row.clientId) throw new OAuthFailure("invalid_grant", "Refresh token was issued to a different client");
  return issueTokens(row.clientId, row.resource, row.scope);
}

export async function verifyAccessToken(token: string, origin: string) {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, sha256(token)), eq(oauthTokens.kind, "access")));
  if (!row || row.secretVersion !== secretVersion() || row.resource !== mcpResource(origin)) return undefined;
  return {
    token,
    clientId: row.clientId,
    scopes: row.scope.split(" "),
    expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
    resource: new URL(row.resource),
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}
