"use server";

import { listSnapshots, type SnapshotInfo } from "@/lib/finance/store";
import { requireSession } from "@/lib/session";

export async function listSnapshotsAction(): Promise<SnapshotInfo[]> {
  await requireSession();
  return listSnapshots();
}
