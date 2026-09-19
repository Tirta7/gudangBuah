self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.notification.body,
        icon: data.notification.icon || '/icon-192.png',
        badge: data.notification.badge || '/icon-192.png',
        vibrate: data.notification.vibrate || [200, 100, 200],
        data: {
          url: (data.notification.data && data.notification.data.url) ? data.notification.data.url : '/'
        },
      };

      event.waitUntil(
        self.registration.showNotification(data.notification.title, options)
      );
    } catch (e) {
      console.error('Failed to parse push notification JSON:', e);
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  const targetUrl = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontkrated: true }).then(function (clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        if ('focus' in client) {
          client.focus();
        }
        if ('navigate' in client) {
          return client.navigate(targetUrl);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});