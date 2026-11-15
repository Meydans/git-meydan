"use client";

import { useEffect, useRef } from "react";
import { addItem, importInventory, patchItem, removeItem, takeSnapshot } from "@/app/(finance)/finance/actions";
import { listSnapshotsAction } from "@/app/(finance)/finance/queries";
import type { Item, SnapshotInfo } from "@/lib/finance/store";
import { initFinance } from "./engine";
import "./finance.css";

// The page itself is the vanilla-JS engine ported from the standalone "where we stand" file;
// React only owns the container, the initial data and the Server Actions it saves through.
export function FinanceClient({ rows, snapshots }: { rows: Item[]; snapshots: SnapshotInfo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return initFinance(ref.current, {
      rows,
      snapshots,
      addItem,
      patchItem,
      removeItem,
      importInventory,
      takeSnapshot,
      listSnapshots: listSnapshotsAction,
    });
    // The engine owns its state after the first render; later prop changes must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="fin" dir="rtl" ref={ref} />;
}
