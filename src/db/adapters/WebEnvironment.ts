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
    if (typeof navigator === 'undefined' || !('locks' in navigator) || !navigator.locks) {
      await acquire(() => {});
      return;
    }

    const abortController = new AbortController();
    const handleTeardown = () => {
      try {
        abortController.abort();
      } catch {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleTeardown);
      window.addEventListener('pagehide', handleTeardown);
    }

    try {
      await navigator.locks.request(
        lockName,
        { signal: abortController.signal },
        async () => {
          return new Promise<void>((resolve) => {
            const onAbort = () => {
              resolve();
            };
            abortController.signal.addEventListener('abort', onAbort, { once: true });

            acquire(() => {
              abortController.signal.removeEventListener('abort', onAbort);
              resolve();
            });
          });
        }
      );
    } catch (err: unknown) {
      const isAbortError =
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
        (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError');

      if (isAbortError) {
        return;
      }
      throw err;
    } finally {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleTeardown);
        window.removeEventListener('pagehide', handleTeardown);
      }
    }
  }
}
