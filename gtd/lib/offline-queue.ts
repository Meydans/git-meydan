"use client";

// Local capture queue. Every capture is written here first and then sent to /api/capture,
// so nothing typed is lost when there is no network or the request dies midway.
// The service worker (lib/sw-source.ts) reads the same database for Background Sync.

import type { Task } from "@/db/schema";

export type QueuedCapture = {
  id: string; // becomes the task id, which makes retries idempotent
  title: string;
  status: Task["status"];
  projectId?: string;
  startDate?: string; // defer date, YYYY-MM-DD
  capturedAt: string;
};

const DB_NAME = "gtd-offline";
const STORE = "captures";
export const SYNC_TAG = "gtd-capture";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gtd-captures") : null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function pendingCaptures(): Promise<QueuedCapture[]> {
  const items = (await tx<QueuedCapture[]>("readonly", (s) => s.getAll())) ?? [];
  return items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

// A BroadcastChannel never delivers to the object that posted, so same-page listeners
// are called directly; the channel carries changes from the service worker and other tabs.
type QueueListener = (event: { synced: number }) => void;
const localListeners = new Set<QueueListener>();

export function onQueueChange(listener: QueueListener) {
  const relay = (e: MessageEvent) => listener({ synced: Number(e.data?.synced) || 0 });
  localListeners.add(listener);
  channel?.addEventListener("message", relay);
  return () => {
    localListeners.delete(listener);
    channel?.removeEventListener("message", relay);
  };
}

function announce(synced = 0) {
  localListeners.forEach((listener) => listener({ synced }));
  channel?.postMessage({ synced });
}

async function send(items: QueuedCapture[]) {
  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new SyncError(res.status);
  return ((await res.json()) as { synced: string[] }).synced;
}

export class SyncError extends Error {
  constructor(public status: number) {
    super(`Sync failed with ${status}`);
  }
}

let inFlight: Promise<number> | null = null;

// Sends everything queued; resolves to how many items reached the server.
export function flush(): Promise<number> {
  inFlight ??= (async () => {
    const items = await pendingCaptures();
    if (items.length === 0) return 0;
    const synced = await send(items);
    await tx("readwrite", (s) => void synced.forEach((id) => s.delete(id)));
    announce(synced.length);
    return synced.length;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Durable capture: queue locally, ask for Background Sync, then try to send right away.
// Resolves to how many items reached the server (0 while offline).
export async function capture(item: Omit<QueuedCapture, "id" | "capturedAt">): Promise<number> {
  const queued: QueuedCapture = { ...item, id: crypto.randomUUID(), capturedAt: new Date().toISOString() };
  try {
    await tx("readwrite", (s) => s.put(queued));
  } catch {
    // No IndexedDB (e.g. some private modes): send directly, there is nowhere to queue.
    await send([queued]);
    announce(1);
    return 1;
  }
  announce();
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register(SYNC_TAG);
  } catch {
    // Background Sync is optional; the page also flushes on "online" and on focus.
  }
  return flush().catch(() => 0);
}
