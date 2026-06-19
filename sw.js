self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const options = {
    body: data.body || "",
    icon: "/idea/icon-192.png",
    badge: "/idea/icon-192.png",
    data: { url: data.url || "/idea/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "이데아", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/idea/";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
