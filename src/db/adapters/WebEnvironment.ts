import { ConnectivityProvider, LifecycleProvider, Unsubscribe } from '@/sync';

export class WebEnvironment implements ConnectivityProvider, LifecycleProvider {
  // ConnectivityProvider
  async isOnline(): Promise<boolean> {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  subscribe(callback: (isOnline: boolean) => void): Unsubscribe {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
    } else if (typeof self !== 'undefined' && 'addEventListener' in self) {
      self.addEventListener('online', onlineHandler);
      self.addEventListener('offline', offlineHandler);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      } else if (typeof self !== 'undefined' && 'removeEventListener' in self) {
        self.removeEventListener('online', onlineHandler);
        self.removeEventListener('offline', offlineHandler);
      }
    };
  }

  subscribeForeground(callback: () => void): Unsubscribe {
    const handler = () => {
      const isHidden = typeof document !== 'undefined' ? document.hidden : false;
      if (!isHidden) {
        callback();
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handler);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handler);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handler);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handler);
      }
    };
  }

  async isForeground(): Promise<boolean> {
    return typeof document !== 'undefined' ? !document.hidden : true;
  }

  onAuthExpired(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-expired'));
    } else if (typeof self !== 'undefined' && 'dispatchEvent' in self) {
      self.dispatchEvent(new Event('auth-expired'));
    }
  }

  async acquireLeaderLock(lockName: string, acquire: (release: () => void) => Promise<void>): Promise<void> {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) {
      await acquire(() => {});
      return;
    }
    
    await navigator.locks.request(lockName, (lock) => {
      return new Promise<void>((resolve) => {
        acquire(() => resolve());
      });
    });
  }
}
