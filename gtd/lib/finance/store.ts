import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { financeDb } from "@/db/finance";
import { financeItems, financeSim, financeSnapshots } from "@/db/finance-schema";
import { defaultAssumptions, type Assumptions } from "./simulator";

export { assumptionsSchema, importRows, itemFields, itemKeys, itemPatch, type ItemKey } from "./fields";
import { assumptionsSchema, itemKeys, type ItemKey } from "./fields";

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
