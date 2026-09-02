const VERSION = 'todom-v1.0.0';

const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/date.js',
  './js/store.js',
  './js/engine.js',
  './js/views/today.js',
  './js/views/tasks.js',
  './js/views/editor.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Installation : on remplit le cache, puis on prend la main sans attendre
// que tous les onglets soient fermés.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

// Activation : on jette les caches des versions précédentes.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(
        noms.filter(n => n !== VERSION).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Lecture : le cache d'abord, le réseau seulement en secours.
// L'appli n'appelle aucun service distant, donc rien à rafraîchir en direct.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(reponse => {
      if (reponse) return reponse;

      return fetch(e.request)
        .then(reseau => {
          // On met en cache ce qui manquait, pour la prochaine fois.
          if (reseau && reseau.ok && reseau.type === 'basic') {
            const copie = reseau.clone();
            caches.open(VERSION).then(c => c.put(e.request, copie));
          }
          return reseau;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
