// Cache-versie: verhoog dit nummer bij een nieuwe deploy zodat de browser de
// service worker als "gewijzigd" herkent en de nieuwe bestanden ophaalt i.p.v.
// voor altijd de oude cache te blijven serveren.
const CACHE_NAME = "meetfoto-cache-v2";
const STATIC_ASSETS = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = event.request.url;
  const isAppShell = event.request.mode === "navigate" || url.endsWith("index.html") || url.endsWith("/");

  if (isAppShell) {
    // App-shell (index.html): ALTIJD eerst het netwerk proberen, zodat updates
    // (nieuwe functies/bugfixes) direct zichtbaar zijn. Alleen bij geen
    // internet valt hij terug op de laatst gecachete versie (offline-gebruik).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Statische assets en externe libraries (iconen, React/Babel-CDN):
  // cache-first is hier veilig, want deze veranderen zelden of nooit.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
