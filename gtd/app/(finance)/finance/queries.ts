"use server";

import { listSnapshots, type SnapshotInfo } from "@/lib/finance/store";
import { requireFinanceSession } from "@/lib/session";

export async function listSnapshotsAction(): Promise<SnapshotInfo[]> {
  await requireFinanceSession();
  return listSnapshots();
}
