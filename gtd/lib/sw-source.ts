// Source of the service worker, served by app/sw.js/route.ts with a per-build version,
// so each deploy installs a fresh worker and re-caches the offline screen with its code.

export function serviceWorkerSource(version: string) {
  return `// GTD service worker, build ${version}
const VERSION = ${JSON.stringify(version)};
const CACHE = "gtd-" + VERSION;
const OFFLINE_URL = "/offline";
const SYNC_TAG = "gtd-capture";

// Cache the offline screen together with the scripts and styles it needs to run.
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(OFFLINE_URL, { cache: "no-store" });
  const html = await res.clone().text();
  const assets = [...new Set(html.match(/\\/_next\\/static\\/[^"'\\s)]+/g) || [])];
  await cache.put(OFFLINE_URL, res);
  await cache.addAll([...assets, "/icons/icon-192.png", "/manifest.webmanifest"]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gtd-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Build assets are content-hashed and immutable, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

// ---------- Background Sync for the capture queue (same database as lib/offline-queue.ts) ----------

function openQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gtd-offline", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("captures", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("captures", mode);
    const req = fn(tx.objectStore("captures"));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db = await openQueue();
  const items = await run(db, "readonly", (s) => s.getAll());
  if (!items.length) return;
  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ items }),
  });
  // 401 means signed out: keep the queue and stop retrying until the app is opened again.
  if (res.status === 401) return;
  if (!res.ok) throw new Error("sync failed: " + res.status);
  const { synced } = await res.json();
  await run(db, "readwrite", (s) => synced.forEach((id) => s.delete(id)));
  new BroadcastChannel("gtd-captures").postMessage({ synced: synced.length });
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushQueue());
});
`;
}
