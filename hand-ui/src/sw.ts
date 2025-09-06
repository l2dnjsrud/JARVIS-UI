// Service worker for caching MediaPipe models
const CACHE_NAME = 'mediapipe-models-v1';
const MODELS_TO_CACHE = [
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/tasks_vision_hand_landmarker.wasm',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/tasks_vision_gesture_recognizer.wasm'
];

// Install event - cache the models
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching MediaPipe models');
        return cache.addAll(MODELS_TO_CACHE);
      })
  );
});

// Fetch event - serve cached models when possible
self.addEventListener('fetch', (event: any) => {
  // Only cache requests for MediaPipe models
  if (MODELS_TO_CACHE.some(url => event.request.url.includes(url))) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version if available
          if (response) {
            console.log('Serving cached model:', event.request.url);
            return response;
          }
          
          // Otherwise fetch from network and cache
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response to put in cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: any) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});