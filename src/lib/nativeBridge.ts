import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Share } from '@capacitor/share';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';

/**
 * Trigger tactile haptic feedback.
 * Uses Capacitor Haptics on native Android/iOS, or Web Vibration API on mobile browsers.
 */
export async function hapticImpact(style: HapticImpactStyle = 'light'): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const impactMap: Record<HapticImpactStyle, ImpactStyle> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: impactMap[style] });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const duration = style === 'heavy' ? 25 : style === 'medium' ? 15 : 8;
      navigator.vibrate(duration);
    }
  } catch {
    // Graceful no-op when haptics are not supported or rejected
  }
}

/**
 * Trigger success notification haptic.
 */
export async function hapticSuccess(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([15, 40, 15]);
    }
  } catch {
    // Graceful no-op
  }
}

/**
 * Trigger selection change haptic tick.
 */
export async function hapticSelection(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionChanged();
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(6);
    }
  } catch {
    // Graceful no-op
  }
}

/**
 * Safely hide the soft keyboard on mobile devices.
 * Uses Capacitor Keyboard on native apps, and blurs active inputs on web.
 */
export async function hideKeyboard(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Keyboard.hide();
    }
  } catch {
    // Ignore keyboard hide error
  }

  // Also blur active input to hide keyboard in mobile browsers
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export interface ShareResult {
  shared: boolean;
  method: 'native' | 'web-share' | 'clipboard' | 'none';
}

/**
 * Share URL using native share sheet, Web Share API, or fallback to clipboard.
 */
export async function shareUrl(options: ShareOptions): Promise<ShareResult> {
  const { title, text, url } = options;

  // 1. Native Capacitor Share (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: title || 'Markbel Bookmark',
        text: text || title,
        url,
        dialogTitle: title || 'Share Bookmark',
      });
      return { shared: true, method: 'native' };
    } catch (err: unknown) {
      // User cancelled share dialog is not a fatal failure
      if (err instanceof Error && err.name === 'AbortError') {
        return { shared: false, method: 'native' };
      }
    }
  }

  // 2. Browser Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: title || 'Markbel Bookmark',
        text: text || title,
        url,
      });
      return { shared: true, method: 'web-share' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { shared: false, method: 'web-share' };
      }
    }
  }

  // 3. Fallback: Copy to Clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { shared: true, method: 'clipboard' };
    } catch {
      // Fallback failed
    }
  }

  return { shared: false, method: 'none' };
}
