import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { financeDb } from "@/db/finance";
import { financeItems, financeSim, financeSnapshots } from "@/db/finance-schema";
import { defaultAssumptions, type Assumptions } from "./simulator";

// The columns of the inventory CSV, in order. The page and the table share these keys.
export const itemKeys = ["name", "type", "owner", "inst", "liq", "liqDate", "purpose", "value", "cur", "monthly", "updated", "how", "check", "notes", "link"] as const;
export type ItemKey = (typeof itemKeys)[number];

const field = z.string().trim().max(2000);
export const itemFields = z.object(Object.fromEntries(itemKeys.map((k) => [k, field.default("")])) as Record<ItemKey, z.ZodDefault<z.ZodString>>);
export const itemPatch = itemFields.partial();
export const importRows = z.array(itemFields).max(1000);

export const summary = z.object({
  net: z.number().finite(),
  total: z.number().finite(),
  debt: z.number().finite(),
  liquid: z.number().finite(),
});
export type Summary = z.infer<typeof summary>;

export type Item = Record<ItemKey, string> & { id: string };
export type SnapshotInfo = Summary & { id: string; takenAt: string; takenBy: string };

const toItem = (r: typeof financeItems.$inferSelect): Item => ({
  id: r.id,
  ...(Object.fromEntries(itemKeys.map((k) => [k, r[k]])) as Record<ItemKey, string>),
});

export async function listItems(): Promise<Item[]> {
  const rows = await financeDb().select().from(financeItems).orderBy(asc(financeItems.position), asc(financeItems.createdAt));
  return rows.map(toItem);
}

export async function listSnapshots(limit = 24): Promise<SnapshotInfo[]> {
  const rows = await financeDb()
    .select({
      id: financeSnapshots.id,
      takenAt: financeSnapshots.takenAt,
      takenBy: financeSnapshots.takenBy,
      net: financeSnapshots.net,
      total: financeSnapshots.total,
      debt: financeSnapshots.debt,
      liquid: financeSnapshots.liquid,
    })
    .from(financeSnapshots)
    .orderBy(desc(financeSnapshots.takenAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, takenAt: r.takenAt.toISOString() }));
}

export async function lastSnapshotAt(): Promise<Date | null> {
  const [row] = await financeDb().select({ at: sql<Date | null>`max(${financeSnapshots.takenAt})` }).from(financeSnapshots);
  return row?.at ? new Date(row.at) : null;
}

export async function createItem(): Promise<Item> {
  const db = financeDb();
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${financeItems.position}), -1) + 1` }).from(financeItems);
  const [row] = await db.insert(financeItems).values({ position: next, cur: "ILS" }).returning();
  return toItem(row);
}

export async function updateItem(id: string, patch: Partial<Record<ItemKey, string>>) {
  if (!Object.keys(patch).length) return;
  await financeDb().update(financeItems).set(patch).where(eq(financeItems.id, id));
}

export async function deleteItem(id: string) {
  await financeDb().delete(financeItems).where(eq(financeItems.id, id));
}

async function insertSnapshot(rows: Item[], sum: Summary, by: string) {
  await financeDb().insert(financeSnapshots).values({ ...sum, takenBy: by, rows });
}

export async function saveSnapshot(sum: Summary, by: string) {
  await insertSnapshot(await listItems(), sum, by);
}

// Replaces the whole inventory (a CSV import). The previous inventory is kept as a snapshot first.
export async function replaceItems(rows: Record<ItemKey, string>[], backup: Summary | null, by: string): Promise<Item[]> {
  const db = financeDb();
  const before = await listItems();
  if (before.length && backup) await insertSnapshot(before, backup, `${by} (לפני ייבוא)`);
  await db.transaction(async (tx) => {
    await tx.delete(financeItems);
    if (rows.length) await tx.insert(financeItems).values(rows.map((r, position) => ({ ...r, position })));
  });
  return listItems();
}

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const assumptionsSchema = z.object({
  currentAge: n(18, 90),
  retirementAge: n(30, 90),
  pensionAge: n(50, 90),
  pensionRatio: n(0, 100),
  roi: n(0, 20),
  inflation: n(0, 10),
  lifestyleCreep: n(0, 10),
  incomeGrowth: n(0, 10),
  glidePath: z.boolean(),
  workAfterRetirement: z.boolean(),
  rule: n(100, 600),
  childrenAges: z.array(n(0, 60)).max(10),
  kidsMonthly: n(0, 1_000_000),
  deductEmergency: z.boolean(),
  events: z.array(z.object({ desc: z.string().trim().max(200), age: n(18, 90), amount: n(-1e9, 1e9) })).max(50),
});

export async function getAssumptions(): Promise<Assumptions> {
  // Until migration 0001 has run the table is missing; the page then works with the defaults.
  const [row] = await financeDb().select().from(financeSim).where(eq(financeSim.id, "main")).catch(() => [undefined]);
  const parsed = assumptionsSchema.safeParse({ ...defaultAssumptions, ...(row?.data as object | undefined) });
  return parsed.success ? parsed.data : defaultAssumptions;
}

export async function saveAssumptions(data: Assumptions, by: string) {
  await financeDb()
    .insert(financeSim)
    .values({ id: "main", data, updatedBy: by })
    .onConflictDoUpdate({ target: financeSim.id, set: { data, updatedBy: by, updatedAt: new Date() } });
}
