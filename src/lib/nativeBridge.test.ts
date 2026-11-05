import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Share } from '@capacitor/share';
import {
  hapticImpact,
  hapticSuccess,
  hapticSelection,
  hideKeyboard,
  shareUrl,
} from './nativeBridge';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionChanged: vi.fn(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
  },
}));

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    hide: vi.fn(),
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(),
  },
}));

describe('nativeBridge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Haptics on Native Platform', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    });

    it('triggers Haptics.impact with Light, Medium, and Heavy styles', async () => {
      await hapticImpact('light');
      expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });

      await hapticImpact('medium');
      expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium });

      await hapticImpact('heavy');
      expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Heavy });
    });

    it('triggers Haptics.notification on success', async () => {
      await hapticSuccess();
      expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Success });
    });

    it('triggers Haptics.selectionChanged on selection', async () => {
      await hapticSelection();
      expect(Haptics.selectionChanged).toHaveBeenCalledTimes(1);
    });

    it('handles native haptic rejections silently', async () => {
      vi.mocked(Haptics.impact).mockRejectedValueOnce(new Error('Hardware unsupported'));
      await expect(hapticImpact('light')).resolves.toBeUndefined();
    });
  });

  describe('Haptics Fallback on Web Browser', () => {
    let mockVibrate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      mockVibrate = vi.fn();
      vi.stubGlobal('navigator', {
        vibrate: mockVibrate,
      });
    });

    it('falls back to navigator.vibrate for hapticImpact', async () => {
      await hapticImpact('light');
      expect(mockVibrate).toHaveBeenCalledWith(8);

      await hapticImpact('medium');
      expect(mockVibrate).toHaveBeenCalledWith(15);

      await hapticImpact('heavy');
      expect(mockVibrate).toHaveBeenCalledWith(25);
    });

    it('falls back to multi-pulse navigator.vibrate for hapticSuccess', async () => {
      await hapticSuccess();
      expect(mockVibrate).toHaveBeenCalledWith([15, 40, 15]);
    });

    it('falls back to short tick navigator.vibrate for hapticSelection', async () => {
      await hapticSelection();
      expect(mockVibrate).toHaveBeenCalledWith(6);
    });
  });

  describe('hideKeyboard', () => {
    it('calls Keyboard.hide when on native platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      await hideKeyboard();
      expect(Keyboard.hide).toHaveBeenCalled();
    });

    it('blurs active element if an input is focused', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const blurMock = vi.fn();

      class MockHTMLElement {
        blur = blurMock;
      }
      vi.stubGlobal('HTMLElement', MockHTMLElement);

      const mockElement = new MockHTMLElement();
      vi.stubGlobal('document', {
        activeElement: mockElement,
      });

      await hideKeyboard();
      expect(blurMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('shareUrl', () => {
    it('uses Capacitor Share when on native platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Share.share).mockResolvedValueOnce({ value: 'shared' } as any);

      const res = await shareUrl({ title: 'My Link', url: 'https://example.com' });
      expect(res).toEqual({ shared: true, method: 'native' });
      expect(Share.share).toHaveBeenCalledWith({
        title: 'My Link',
        text: 'My Link',
        url: 'https://example.com',
        dialogTitle: 'My Link',
      });
    });

    it('gracefully handles user cancelling native share dialog (AbortError)', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const abortError = new Error('Share canceled');
      abortError.name = 'AbortError';
      vi.mocked(Share.share).mockRejectedValueOnce(abortError);

      const res = await shareUrl({ title: 'My Link', url: 'https://example.com' });
      expect(res).toEqual({ shared: false, method: 'native' });
    });

    it('uses navigator.share when available on web', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const mockShare = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        share: mockShare,
      });

      const res = await shareUrl({ title: 'Web Link', url: 'https://example.com/web' });
      expect(res).toEqual({ shared: true, method: 'web-share' });
      expect(mockShare).toHaveBeenCalledWith({
        title: 'Web Link',
        text: 'Web Link',
        url: 'https://example.com/web',
      });
    });

    it('falls back to navigator.clipboard when navigator.share is unavailable', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const res = await shareUrl({ title: 'Clip Link', url: 'https://example.com/clip' });
      expect(res).toEqual({ shared: true, method: 'clipboard' });
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/clip');
    });
  });
});
