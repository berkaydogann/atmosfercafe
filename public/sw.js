// Service Worker for Push Notifications

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'Bildirim';
    const options = {
      body: data.body || '',
      icon: data.icon || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=100&q=80',
      badge: data.badge || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=100&q=80',
      tag: data.tag || 'notification',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: data.data || {}
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', event => {
  console.log('Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Varsa açık window'a odaklan
      for (let client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni window aç
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
