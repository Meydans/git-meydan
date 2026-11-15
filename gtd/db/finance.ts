import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./finance-schema";

let cached: ReturnType<typeof create> | undefined;

function create(url: string) {
  // prepare: false keeps this compatible with Neon's pooled (PgBouncer) connection string.
  return drizzle(postgres(url, { prepare: false }), { schema });
}

export const financeConfigured = () => !!process.env.DATABASE_URL_FINANCE;

// Created on first use, so a deployment without DATABASE_URL_FINANCE still builds and runs.
export function financeDb() {
  const url = process.env.DATABASE_URL_FINANCE;
  if (!url) throw new Error("DATABASE_URL_FINANCE is not set");
  return (cached ??= create(url));
}
