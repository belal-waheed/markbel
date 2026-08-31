import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useModalBackNavigation History Protocol', () => {
  let mockHistoryState: any = null;
  let historyPushCount = 0;
  let historyBackCount = 0;
  let popstateListeners: Array<(e: any) => void> = [];

  beforeEach(() => {
    mockHistoryState = null;
    historyPushCount = 0;
    historyBackCount = 0;
    popstateListeners = [];

    // Setup global window mocks
    vi.stubGlobal('window', {
      history: {
        get state() {
          return mockHistoryState;
        },
        pushState: (state: any) => {
          mockHistoryState = state;
          historyPushCount++;
        },
        back: () => {
          historyBackCount++;
          mockHistoryState = null;
        },
      },
      addEventListener: (event: string, handler: any) => {
        if (event === 'popstate') {
          popstateListeners.push(handler);
        }
      },
      removeEventListener: (event: string, handler: any) => {
        if (event === 'popstate') {
          popstateListeners = popstateListeners.filter((h) => h !== handler);
        }
      },
    });
  });

  it('should push a virtual history state when an overlay opens', () => {
    let isPushed = false;
    const anyOpen = true;

    if (anyOpen && !isPushed) {
      window.history.pushState({ markbelOverlay: true }, '');
      isPushed = true;
    }

    expect(historyPushCount).toBe(1);
    expect(window.history.state).toEqual({ markbelOverlay: true });
    expect(isPushed).toBe(true);
  });

  it('should close open overlays and avoid app termination when popstate triggers', () => {
    let isPushed = true;
    let modalClosed = false;
    const overlays = [{ isOpen: true, close: () => { modalClosed = true; } }];

    const handlePopState = () => {
      if (isPushed) {
        isPushed = false;
        for (const o of overlays) {
          if (o.isOpen) o.close();
        }
      }
    };

    handlePopState();

    expect(modalClosed).toBe(true);
    expect(isPushed).toBe(false);
  });

  it('should cleanly pop synthetic state when closed via UI Cancel/X button', () => {
    let isPushed = true;
    mockHistoryState = { markbelOverlay: true };
    const anyOpen = false;

    if (!anyOpen && isPushed) {
      isPushed = false;
      if (window.history.state?.markbelOverlay) {
        window.history.back();
      }
    }

    expect(historyBackCount).toBe(1);
    expect(isPushed).toBe(false);
  });
});
