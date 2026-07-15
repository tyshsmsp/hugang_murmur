const CACHE_NAME = 'hugang-murmur-v2-cache';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // 僅快取 GET 請求，且排除 Google Sheets / Google Apps Script API 連線
  if (event.request.method !== 'GET' || 
      event.request.url.includes('google.com') || 
      event.request.url.includes('spreadsheets') || 
      event.request.url.includes('google-user-content')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // 背景非同步更新快取 (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(err => console.log('SW Background Update Failed:', err));
        
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
