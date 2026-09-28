const CACHE_NAME = 'levieux-v1';
const URLS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/bg-home.jpg',
  '/bg-today.jpg',
  '/bg-subscribe.png',
  '/baobab.jpg',
  '/pattern.png'
];

// Installation : mettre en cache les ressources statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        URLS_TO_CACHE.map(url => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// Activation : nettoyer les vieux caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch : stratégie hybride
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les appels API (POST, etc.)
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/me') ||
      url.pathname.startsWith('/ask') ||
      url.pathname.startsWith('/daily') ||
      url.pathname.startsWith('/teaching') ||
      url.pathname.startsWith('/challenge') ||
      url.pathname.startsWith('/library') ||
      url.pathname.startsWith('/support') ||
      url.pathname.startsWith('/tts') ||
      url.pathname.startsWith('/preload') ||
      url.pathname.startsWith('/admin') ||
      url.pathname.startsWith('/webhook')) {
    return;
  }

  // Images : cache-first (rapide, offline friendly)
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML/JS/CSS : network-first (toujours frais, cache en fallback)
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
