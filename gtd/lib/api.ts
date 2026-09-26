import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DATE_ORDER_MESSAGE, PG_CHECK, PG_FOREIGN_KEY, pgErrorCode } from "./pg";
import { idParam } from "./validation";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function checkAuth(request: Request) {
  const expected = process.env.API_TOKEN;
  if (!expected) throw new HttpError(500, "API_TOKEN is not configured");

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  // Compare fixed-length hashes so the check doesn't leak the token length or prefix.
  if (!timingSafeEqual(sha256(token), sha256(expected))) {
    throw new HttpError(401, "Missing or invalid bearer token");
  }
}

// Maps Postgres error codes we expect from user input to 400s.
function fromPgError(error: unknown) {
  const code = pgErrorCode(error);
  if (code === PG_FOREIGN_KEY) return new HttpError(400, "projectId does not reference an existing project");
  if (code === PG_CHECK) return new HttpError(400, DATE_ORDER_MESSAGE);
  return null;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

// Wraps a route handler with bearer-token auth and JSON error responses.
export function handler<C>(fn: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      checkAuth(request);
      return await fn(request, context);
    } catch (error) {
      const httpError =
        error instanceof HttpError
          ? error
          : error instanceof z.ZodError
            ? new HttpError(400, "Invalid request", z.flattenError(error))
            : fromPgError(error);
      if (httpError) {
        return Response.json(
          { error: httpError.message, details: httpError.details },
          { status: httpError.status },
        );
      }
      console.error(error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function searchParams(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}

// Resolves the [id] route param; a malformed UUID can't match any row, so it's a 404.
export async function resolveId(params: Promise<{ id: string }>, what: string) {
  const { id } = await params;
  if (!idParam.safeParse(id).success) throw notFound(what);
  return id;
}

export function requireFields(body: object) {
  if (Object.keys(body).length === 0) throw new HttpError(400, "No fields to update");
}
