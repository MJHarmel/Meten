// Cache-versie: verhoog dit nummer bij een nieuwe deploy zodat de browser de
// service worker als "gewijzigd" herkent en de nieuwe bestanden ophaalt i.p.v.
// voor altijd de oude cache te blijven serveren.
const CACHE_NAME = "meetfoto-cache-v4";
const STATIC_ASSETS = [
  "./manifest.json",
  "./icon/icon-192.png",
  "./icon/icon-512.png",
  "./icon/icon-maskable-512.png",
  "./icon/apple-touch-icon.png",
  "./icon/favicon-32.png",
];
// De app-shell zelf apart precachen (met expliciete no-cache fetch) zodat er
// al na het ALLEREERSTE bezoek een offline-fallback beschikbaar is — niet pas
// na een tweede keer online laden.
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS).catch(() => {});
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: "no-store" });
            if (resp && resp.ok) await cache.put(url, resp.clone());
          } catch (e) {}
        })
      );
    })()
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
        .catch(() =>
          caches.match(event.request).then((r) => r || caches.match("./index.html"))
        )
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
