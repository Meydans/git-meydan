import { z } from "zod";

// The columns of the inventory CSV, in order. The page and the table share these keys.
export const itemKeys = ["name", "type", "owner", "inst", "liq", "liqDate", "purpose", "value", "cur", "monthly", "updated", "how", "check", "notes", "link"] as const;
export type ItemKey = (typeof itemKeys)[number];

const field = z.string().trim().max(2000);
export const itemFields = z.object(Object.fromEntries(itemKeys.map((k) => [k, field.default("")])) as Record<ItemKey, z.ZodDefault<z.ZodString>>);
// A patch must carry only the keys it names. Building it from itemFields.partial() would not do:
// zod 4 still applies each field's default, so every edit would blank all the other columns.
export const itemPatch = z.object(Object.fromEntries(itemKeys.map((k) => [k, field.optional()])) as Record<ItemKey, z.ZodOptional<z.ZodString>>);
export const importRows = z.array(itemFields).max(1000);
