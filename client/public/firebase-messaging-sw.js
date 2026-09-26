/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Initialize Firebase inside Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyAjgEsRyjgfJ5Y5VPhA85JIgS55BycIBf8",
  authDomain: "teffe-development.firebaseapp.com",
  projectId: "teffe-development",
  storageBucket: "teffe-development.firebasestorage.app",
  messagingSenderId: "634799767426",
  appId: "1:634799767426:web:34005b318342e1a1ae599b",
});

const messaging = firebase.messaging();

// Handle background notification delivery
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background push received:", payload);

  const title = payload.notification?.title || payload.data?.title || "TeFFe's Fresh Alert";
  const body = payload.notification?.body || payload.data?.body || "";
  const clickAction = payload.data?.clickAction || payload.data?.url || "/dashboard";

  const notificationOptions = {
    body: body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: clickAction,
      ...payload.data,
    },
    requireInteraction: false,
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click to focus or navigate
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open with the URL, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
