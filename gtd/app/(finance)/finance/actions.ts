"use server";

import { z } from "zod";
import { requireFinanceSession } from "@/lib/session";
import {
  createItem,
  deleteItem,
  importRows,
  itemPatch,
  listSnapshots,
  replaceItems,
  saveSnapshot,
  summary,
  updateItem,
  type Item,
  type SnapshotInfo,
} from "@/lib/finance/store";

// Every action checks the session itself: Server Actions are public endpoints, and the layout
// check does not cover them.
const id = z.uuid();

export async function addItem(): Promise<Item> {
  await requireFinanceSession();
  return createItem();
}

export async function patchItem(itemId: string, patch: unknown): Promise<void> {
  await requireFinanceSession();
  await updateItem(id.parse(itemId), itemPatch.parse(patch));
}

export async function removeItem(itemId: string): Promise<void> {
  await requireFinanceSession();
  await deleteItem(id.parse(itemId));
}

export async function importInventory(rows: unknown, backup: unknown): Promise<Item[]> {
  const email = await requireFinanceSession();
  return replaceItems(importRows.parse(rows), backup ? summary.parse(backup) : null, email);
}

export async function takeSnapshot(sum: unknown): Promise<SnapshotInfo[]> {
  const email = await requireFinanceSession();
  await saveSnapshot(summary.parse(sum), email);
  return listSnapshots();
}
