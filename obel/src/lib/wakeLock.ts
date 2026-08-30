/**
 * Wake Lock API helper to prevent screen from sleeping during active focus sessions.
 * Helps ensure timers are not throttled by the OS when the screen stays on.
 */
interface WakeLockSentinel extends EventTarget {
  release(): Promise<void>;
}

class WakeLockSystem {
  private sentinel: WakeLockSentinel | null = null;

  async request() {
    if (!('wakeLock' in navigator)) {
      // console.log('Wake Lock API not supported');
      return;
    }

    try {
      this.sentinel = await (navigator as unknown as { wakeLock: { request(type: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      // console.log('Wake Lock active');
      
      this.sentinel.addEventListener('release', () => {
        // console.log('Wake Lock released');
        this.sentinel = null;
      });
    } catch (err: unknown) {
      console.error('Failed to request wake lock:', err);
    }
  }

  async release() {
    if (this.sentinel) {
      await this.sentinel.release();
      this.sentinel = null;
    }
  }
}

export const wakeLockSystem = new WakeLockSystem();
