/**
 * Browser Notification API wrapper for Obel.
 */

interface ExtendedNotificationOptions extends NotificationOptions {
  showTrigger?: unknown;
}

// In-memory scheduled notifications fallback
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

class NotificationSystem {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Explicitly request and verify notification permission.
   * Returns true if permission was granted.
   */
  async requestAndVerify(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  private getBadgeForTagOrTitle(tag?: string, title?: string): string {
    const combined = `${tag || ''} ${title || ''}`.toLowerCase();
    if (combined.includes('task')) {
      return '/icons/badge-task.svg';
    }
    if (combined.includes('habit')) {
      return '/icons/badge-habit.svg';
    }
    if (combined.includes('timer') || combined.includes('session') || combined.includes('break')) {
      return '/icons/badge-timer.svg';
    }
    return '/obel.png'; // Default fallback
  }

  async send(title: string, options?: ExtendedNotificationOptions) {
    if (!('Notification' in window)) return;
    
    const permission = Notification.permission;
    if (permission === 'default') {
      await this.requestPermission();
    }
    
    if (Notification.permission === 'granted') {
      let swSuccess = false;
      if ('serviceWorker' in navigator) {
        try {
          // Use a timeout for .ready to avoid hanging if SW registration fails
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);

          if (reg) {
            const badge = options?.badge || this.getBadgeForTagOrTitle(options?.tag, title);
            await reg.showNotification(title, {
              icon: '/obel.png',
              badge,
              vibrate: [200, 100, 200],
              renotify: true,
              tag: 'obel-immediate',
              data: { url: '/' },
              ...options,
            } as NotificationOptions);
            swSuccess = true;
          }
        } catch (err) {
          console.warn('[Notification] SW registration not ready, falling back to new Notification()');
        }
      }

      if (!swSuccess) {
        try {
          const badge = options?.badge || this.getBadgeForTagOrTitle(options?.tag, title);
          new Notification(title, {
            icon: '/obel.png',
            badge,
            ...options,
          } as NotificationOptions);
        } catch (err) {
          console.error('[Notification] Error creating notification:', err);
          this.showInAppFallback(title);
        }
      }
    } else {
      // Permission not granted — fallback to in-app
      this.showInAppFallback(title);
    }
    
    // Play sound if requested (or by default) and not silent
    if (!options?.silent) {
      this.playSound();
    }
  }

  private playSound() {
    try {
      const audio = new Audio('/finish-session.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.warn('[Notification] Audio play blocked:', e));
    } catch (e) {
      console.warn('[Notification] Sound error:', e);
    }
  }

  async schedule(title: string, triggerTimestamp: number, tag: string, options?: ExtendedNotificationOptions) {
    if (!('Notification' in window)) return;
    const permission = await this.requestPermission();
    
    if (permission && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if ('TimestampTrigger' in window) {
          const WindowWithTrigger = window as unknown as { TimestampTrigger: new (t: number) => unknown };
          const trigger = WindowWithTrigger.TimestampTrigger ? new WindowWithTrigger.TimestampTrigger(triggerTimestamp) : null;
          
          if (trigger) {
            const badge = options?.badge || this.getBadgeForTagOrTitle(tag, title);
            await reg.showNotification(title, {
              icon: '/obel.png',
              badge,
              tag,
              silent: false,
              vibrate: [200, 100, 200, 100, 200, 100, 200],
              showTrigger: trigger,
              data: { url: '/pomodoro' },
              ...options,
            } as NotificationOptions);
            this.playSound();
            return; // Successfully scheduled via SW
          }
        }
      } catch {
        console.log('Obel Notification System: SW schedule failed, using timer fallback');
      }
    }

    // Fallback: use setTimeout for in-memory scheduling
    const delay = triggerTimestamp - Date.now();
    if (delay > 0) {
      // Cancel any existing timer for this tag
      this.cancelScheduled(tag);
      
      const timer = setTimeout(() => {
        this.send(title, { tag, ...options } as ExtendedNotificationOptions);
        scheduledTimers.delete(tag);
      }, delay);
      scheduledTimers.set(tag, timer);
    }
  }

  async cancelScheduled(tag: string) {
    // Clear in-memory timer
    const timer = scheduledTimers.get(tag);
    if (timer) {
      clearTimeout(timer);
      scheduledTimers.delete(tag);
    }

    // Also clear SW notifications
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const notifications = await reg.getNotifications({ tag });
        notifications.forEach(n => n.close());
      } catch {
        // silently ignore error if SW fails to retrieve notifications
      }
    }
  }

  /**
   * Dismiss all active notifications from the service worker.
   */
  async clearAll() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const notifications = await reg.getNotifications();
        notifications.forEach(n => n.close());
      } catch (err) {
        console.warn('[Notification] Failed to clear notifications:', err);
      }
    }
  }

  /**
   * Fallback: show a toast notification in the app when browser
   * notifications are unavailable.
   */
  private showInAppFallback(title: string) {
    try {
      // Dynamic import to avoid circular dependencies
      import('@/stores/toastStore').then(({ useToastStore }) => {
        useToastStore.getState().showToast(title);
      });
    } catch {
      console.warn('[Notification]', title);
    }
  }

  /**
   * Subscribes the current device browser to Web Push notifications and registers it in MongoDB.
   */
  async registerPushSubscription(userId: string) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push notifications not supported on this browser.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      
      // Get active notification permission with retry logic
      let permission = Notification.permission;
      if (permission === 'default') {
        const result = await this.requestPermission();
        permission = result ? 'granted' : 'denied';
      }
      
      if (permission !== 'granted') {
        console.log(`[Push] Notification permission is ${permission}. User must grant permission to receive push notifications.`);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined.');
        return;
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      // Check if already subscribed
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        // Subscribe to Push Service if not already subscribed
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
        console.log('[Push] New subscription created:', subscription.endpoint.substring(0, 50) + '...');
      } else {
        console.log('[Push] Device already subscribed:', subscription.endpoint.substring(0, 50) + '...');
      }

      // Send to backend with client local timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription, timezone })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      console.log('[Push] Push subscription synced with MongoDB.');
    } catch (err) {
      console.error('[Push] Failed to register push subscription:', err);
    }
  }

  /**
   * Checks if there is an active Web Push subscription registered on the client.
   */
  async hasActivePushSubscription(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  }
}

export const notificationSystem = new NotificationSystem();
