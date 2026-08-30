self.addEventListener('push', (event) => {
  let data = { title: 'Markbel Notification', body: 'You have updates in your bookmark vault!', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    console.warn('[SW Push] Failed to parse push JSON:', err);
  }

  const options = {
    body: data.body || 'New bookmark update',
    icon: '/logo.png',
    badge: '/logo.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Markbel' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Markbel 🔖', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept POST /share for Instant Quick-Save
  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const sharedTitle = (formData.get('title') || '').toString();
        const sharedText = (formData.get('text') || '').toString();
        let sharedUrl = (formData.get('url') || '').toString();

        // Fallback for Android Chrome/Edge where URL might be inside text field
        if (!sharedUrl && sharedText) {
          const urlRegex = /(https?:\/\/[^\s]+)/;
          const match = sharedText.match(urlRegex);
          if (match) {
            sharedUrl = match[0];
          }
        }

        if (sharedUrl) {
          const dbRequest = indexedDB.open('MarkbelDatabase');
          
          await new Promise((resolve, reject) => {
            dbRequest.onsuccess = (e) => {
              const db = e.target.result;
              const tx = db.transaction(['bookmarks', 'syncOutbox'], 'readwrite');
              const bookmarksStore = tx.objectStore('bookmarks');
              const outboxStore = tx.objectStore('syncOutbox');
              
              const now = new Date().toISOString();
              const id = crypto.randomUUID();
              
              const bookmark = {
                id,
                userId: 'offline-pending',
                title: sharedTitle.trim() || sharedUrl,
                url: sharedUrl,
                description: sharedText !== sharedUrl ? sharedText : '',
                image: '',
                group: 'Unsorted',
                isRead: false,
                isPinned: false,
                isArchived: false,
                version: 0,
                createdAt: now,
                updatedAt: now,
                deletedAt: null
              };
              
              bookmarksStore.add(bookmark);
              
              const outboxItem = {
                id: crypto.randomUUID(),
                entityType: 'bookmark',
                entityId: id,
                operation: 'create',
                baseVersion: 0,
                payload: bookmark,
                status: 'pending',
                attempts: 0,
                createdAt: now
              };
              
              outboxStore.add(outboxItem);
              
              tx.oncomplete = resolve;
              tx.onerror = reject;
            };
            dbRequest.onerror = reject;
          });
        }
        
        // Native Toast Notification
        self.registration.showNotification('Markbel 🔖', {
          body: 'Bookmark saved instantly to Unsorted!',
          icon: '/logo.png',
          vibrate: [50, 50, 50],
        });
        
        // Return instant close response
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Saved</title><script>window.close();</script></head><body style="background:#090d16;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;">Saved to Markbel! Closing...</body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      } catch (err) {
        console.error('[SW Share Target Error]', err);
        return Response.redirect('/', 303);
      }
    })());
  }
});
