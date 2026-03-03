// ═══════════════════════════════════════════════════════════════
//  SkyLine — Service Worker (PWA offline cache)
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'skyline-v1';

// Archivos esenciales para funcionar offline
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',

  // Core engine
  './js/index.js',
  './js/GameManager.js',
  './js/EconomyEngine.js',
  './js/RouteEngine.js',
  './js/EventEngine.js',
  './js/SaveSystem.js',
  './js/data/models.js',

  // UI
  './js/ui/ui-state.js',
  './js/ui/ui-hud.js',
  './js/ui/ui-map.js',
  './js/ui/ui-airport-panel.js',
  './js/ui/ui-new-route.js',
  './js/ui/ui-panels.js',
  './js/ui/ui-game.js',
  './js/ui/ui-planner.js',
];

// ─────────────────────────────────────────────────────────────
//  INSTALL — pre-cachear assets esenciales
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear uno a uno para no fallar en bloque si un asset falla
      return Promise.allSettled(
        CORE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────────────
//  ACTIVATE — limpiar cachés antiguas
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────
//  FETCH — Cache-first con network fallback
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Tiles de mapa / CDNs externos → Network-first (no llenar caché con tiles)
  const isExternal = url.hostname !== self.location.hostname &&
                     !url.pathname.startsWith('/skyline_simulator/');
  if (isExternal) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets propios → Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    )
  );
});
