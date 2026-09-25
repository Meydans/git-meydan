// Source of the service worker, served by app/sw.js/route.ts with a per-build version,
// so each deploy installs a fresh worker and re-caches the offline screen with its code.

export function serviceWorkerSource(version: string) {
  return `// GTD service worker, build ${version}
const VERSION = ${JSON.stringify(version)};
const CACHE = "gtd-" + VERSION;
// Pages are cached per build too: their HTML references this build's scripts.
const PAGES = "gtd-pages-" + VERSION;
const OFFLINE_URL = "/offline";
const SYNC_TAG = "gtd-capture";
const MAX_PAGES = 80;
// The main lists, refreshed in the background so they're current when the network is gone.
const WARM_URLS = ["/inbox", "/next", "/waiting", "/scheduled", "/someday", "/done", "/projects"];
// App pages worth keeping for offline reading. Everything else (login, OAuth, API) is never cached.
const CACHEABLE = ["/inbox", "/next", "/waiting", "/scheduled", "/someday", "/done", "/projects", "/tasks"];
const isCacheable = (path) => CACHEABLE.some((prefix) => path === prefix || path.startsWith(prefix + "/"));

// Cache the offline screen together with the scripts and styles it needs to run.
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(OFFLINE_URL, { cache: "no-store" });
  const html = await res.clone().text();
  const assets = [...new Set(html.match(/\\/_next\\/static\\/[^"'\\s)]+/g) || [])];
  await cache.put(OFFLINE_URL, res);
  await cache.addAll([...assets, "/icons/icon-192.png", "/manifest.webmanifest"]);
}

// Stores a page for offline reading. A redirect means the session ended: drop what's cached.
async function storePage(request, response) {
  if (response.redirected || new URL(response.url).pathname === "/login") {
    await caches.delete(PAGES);
    return;
  }
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !type.includes("text/html")) return;
  const cache = await caches.open(PAGES);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map((key) => cache.delete(key)));
}

async function warmPages() {
  await Promise.all(
    WARM_URLS.map((url) =>
      fetch(url, { credentials: "same-origin" })
        .then((response) => storePage(new Request(url), response))
        .catch(() => {}),
    ),
  );
}

// Marks a page served from the cache so the app can show it as a read-only snapshot.
async function markCached(response) {
  const html = await response.text();
  const marked = html.replace("</head>", '<meta name="gtd-from-cache" content="1"></head>');
  return new Response(marked, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function offlinePage(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  // Exact URL first (filters included), then the same page without its query string.
  const opts = { ignoreVary: true };
  const cached = (await cache.match(request, opts)) || (await cache.match(url.origin + url.pathname, opts));
  return cached ? markCached(cached) : caches.match(OFFLINE_URL);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => warmPages()).then(() => self.skipWaiting()));
});

self.addEventListener("message", (event) => {
  if (event.data === "warm") event.waitUntil(warmPages());
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gtd-") && k !== CACHE && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: network first, keeping a copy of app pages; with no network, the last copy or the offline screen.
  if (request.mode === "navigate") {
    const cacheable = isCacheable(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable) event.waitUntil(storePage(request, response.clone()));
          return response;
        })
        .catch(() => (cacheable ? offlinePage(request) : caches.match(OFFLINE_URL))),
    );
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
