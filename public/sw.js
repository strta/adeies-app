// Service worker: η εφαρμογή ανοίγει και χωρίς σύνδεση (τα δεδομένα τα κρατά το Firestore cache).
const CACHE = "adeies-v7";
const SHELL = ["/", "/index.html", "/css/app.css", "/js/app.js", "/js/store.js", "/js/views.js", "/js/ui.js", "/js/logic.js",
  "/js/docgen.js", "/js/defaults.js", "/js/config.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png",
  "/templates/ypereories.docx", "/templates/aitisi-adeias.docx", "/templates/aitisi-diwris.docx",
  "/templates/aitisi-anarrotikis.docx", "/vendor/jszip.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Πρώτα δίκτυο (για να έρχονται πάντα οι νέες εκδόσεις), cache αν δεν υπάρχει σύνδεση.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__/")) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("/index.html"))),
  );
});
