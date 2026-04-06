// Timeline Management Service Worker
// Caches the app shell for offline loading; API requests handled by the app
// using the in-app localStorage queue (see src/utils/clockQueue.ts).

const CACHE_NAME = "timeline-shell-v1";

// App shell resources to pre-cache on install
const SHELL_URLS = ["/", "/my-schedule", "/dashboard", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete old caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let API requests and non-GET requests bypass the cache entirely
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first for navigation requests; fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images)
  event.respondWith(
    caches.match(request).then(
      (cached) => cached || fetch(request).then((response) => {
        // Cache successful static asset responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
    )
  );
});
