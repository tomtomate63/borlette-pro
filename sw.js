// sw.js - Service Worker pour Borlette Pro (Version corrigée)
const CACHE_NAME = 'borlette-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/agent-app/index.html',
  '/agent-app/style.css',
  '/agent-app/script.js',
  '/admin-app/index.html',
  '/admin-app/style.css',
  '/admin-app/script.js',
  '/caissier-app/index.html',
  '/caissier-app/style.css',
  '/caissier-app/script.js',
  '/app-unique/index.html',
  '/app-unique/style.css',
  '/app-unique/script.js',
  '/icon/icon-100.png'
];

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Erreur de cache:', err);
      })
  );
  self.skipWaiting();
});

// Activation - suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Stratégie: Stale-While-Revalidate
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Ignorer les requêtes API
  if (url.includes('/api/')) {
    return;
  }
  
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Mettre à jour le cache avec la nouvelle version
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse.clone();
      }).catch(err => {
        console.log('Erreur fetch:', err);
        // En cas d'erreur réseau, retourner la réponse en cache si disponible
        if (cachedResponse) {
          return cachedResponse;
        }
        // Sinon, retourner une page d'erreur
        return caches.match('/offline.html');
      });
      
      // Retourner la réponse en cache immédiatement si disponible,
      // puis mettre à jour en arrière-plan
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetchPromise;
    })
  );
});