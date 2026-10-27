/* Service worker: deja la app instalable y abre aunque no haya internet.
   Cuando cambies archivos, sube el número de CACHE para que los celulares tomen la versión nueva. */
const CACHE = "luca-v37";
const SHELL = ["./", "index.html", "styles.css", "i18n-en.js", "i18n.js", "app.js", "extras.js", "pro.js", "asistente.js", "recibo.js", "boot.js", "vendor/supabase-2.45.4.js", "config.js", "logo/logo.svg", "fonts/inter.woff2", "manifest.webmanifest", "privacidad.html", "terminos.html", "eliminar-cuenta.html",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
const CDN = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "luca-avisos").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Primero la red (para tener siempre la última versión); si no hay internet, la copia guardada.
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else if (CDN.includes(url.hostname)) {
    // Librerías y fuentes con versión fija: primero la copia guardada.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
  // Supabase y datos.gov.co van siempre directo a internet.
});

/* Avisos de pago en segundo plano (Android con Chrome, cuando el sistema lo permite).
   La app guarda las próximas fechas en la caché "luca-avisos"; aquí solo se leen y se avisa. */
self.addEventListener("periodicsync", e => { if (e.tag === "luca-avisos") e.waitUntil(avisar()); });
async function avisar() {
  const c = await caches.open("luca-avisos"); const r = await c.match("avisos.json"); if (!r) return;
  const d = await r.json(); const en = d.lang === "en";
  const p2 = n => String(n).padStart(2, "0"); const iso = x => x.getFullYear() + "-" + p2(x.getMonth() + 1) + "-" + p2(x.getDate());
  const hoy = new Date(), t0 = iso(hoy), t1 = iso(new Date(hoy.getTime() + 864e5));
  for (const it of d.items || []) {
    if (it.fecha !== t0 && it.fecha !== t1) continue; const man = it.fecha === t1;
    const title = en ? it.nombre + (man ? " is due tomorrow" : " is due today") : (man ? "Mañana vence " : "Hoy vence ") + it.nombre;
    const body = it.valor ? (en ? "Minimum: " : "Mínimo: ") + "$ " + Math.round(it.valor).toLocaleString("es-CO") : (en ? "Open Luca to see the amount." : "Abre Luca para ver el valor.");
    await self.registration.showNotification(title, { body, tag: "luca-" + it.id + "-" + it.fecha, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: "./" } });
  }
}
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ("focus" in w) return w.focus();
    return self.clients.openWindow("./");
  }));
});
