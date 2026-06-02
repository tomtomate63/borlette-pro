// sw.js - Service Worker pour Borlette Pro
const CACHE_NAME = 'borlette-v1';
const urlsToCache = [
  '/',
  '/agent-app/index.html',
  '/agent-app/script.js',
'/agent-app/style.css',
  '/admin-app/index.html',
  '/admin-app/script.js',
  '/admin-app/style.css',
  '/manifest.json'
];

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.log('Impossible de mettre en cache:', url, err);
            });
          })
        );
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  // Ignorer toutes les requêtes API
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // Pour les fichiers statiques, utiliser le cache
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Mise à jour
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});