import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/finance-schema.ts",
  out: "./db/finance-migrations",
  dialect: "postgresql",
  schemaFilter: ["finance"],
  // Keep the migration log in the finance schema, apart from the GTD one.
  migrations: { table: "__finance_migrations", schema: "finance" },
  dbCredentials: {
    url: process.env.DATABASE_URL_FINANCE_UNPOOLED ?? process.env.DATABASE_URL_FINANCE!,
  },
});
