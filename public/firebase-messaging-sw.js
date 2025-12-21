// Firebase Cloud Messaging Service Worker
// This service worker handles background notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmOb4_OzMIKo4jjueeTd4iE9gp9Kyi7QE",
    authDomain: "atmosfercafe.firebaseapp.com",
    projectId: "atmosfercafe",
    storageBucket: "atmosfercafe.firebasestorage.app",
    messagingSenderId: "156933987584",
    appId: "1:156933987584:web:6e87f2907dfb1dcf68e7e5"
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);

    // Extract notification data
    const notificationTitle = payload.notification?.title || '🎉 Siparişiniz Hazır!';
    const notificationOptions = {
        body: payload.notification?.body || 'Siparişiniz hazır. Lütfen kafeye gelerek alabilirsiniz.',
        icon: payload.notification?.icon || '/img/logo.png',
        badge: '/img/logo.png',
        tag: 'order-ready',
        requireInteraction: true, // Keep notification visible until user interacts
        data: {
            url: '/', // URL to open when notification is clicked
            orderId: payload.data?.orderId,
            orderNumber: payload.data?.orderNumber,
            item: payload.data?.item
        },
        vibrate: [200, 100, 200], // Vibration pattern
        actions: [
            {
                action: 'view',
                title: 'Siparişi Gör'
            }
        ]
    };

    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);

    event.notification.close();

    // Open the app or focus existing window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === self.location.origin + '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If app is not open, open it
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Service Worker Installation
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker installing...');
    self.skipWaiting();
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activated');
    event.waitUntil(clients.claim());
});
