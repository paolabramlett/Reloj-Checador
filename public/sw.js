/**
 * Service worker mínimo: hace la PWA instalable y toma control inmediato.
 * La cola offline de fichajes (grupo 4 de tasks) vive en IndexedDB desde la
 * app, no aquí; este SW crecerá solo si hace falta precaching de shell.
 */
const VERSION = "v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough: la red maneja todo por ahora. Existe porque algunos
  // navegadores exigen un handler de fetch para considerar la app instalable.
});
