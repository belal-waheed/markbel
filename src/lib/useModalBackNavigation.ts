import { useEffect, useRef } from "react";

export interface OverlayState {
  isOpen: boolean;
  close: () => void;
}

/**
 * useModalBackNavigation
 * 
 * Traps the browser/Android hardware back button when any modal, card detail,
 * or sidebar is open, closing the overlay instead of navigating away or closing the web app.
 */
export function useModalBackNavigation(overlays: OverlayState[]) {
  const isPushedRef = useRef(false);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const anyOpen = overlays.some((o) => o.isOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (anyOpen && !isPushedRef.current) {
      // Push history state when an overlay opens
      window.history.pushState({ markbelOverlay: true, time: Date.now() }, "");
      isPushedRef.current = true;
    } else if (!anyOpen && isPushedRef.current) {
      // All overlays closed via UI clicks (Cancel/X/Save/backdrop)
      isPushedRef.current = false;
      if (window.history.state?.markbelOverlay) {
        window.history.back();
      }
    }

    const handlePopState = () => {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        // Close all open overlays in priority order
        for (const overlay of overlaysRef.current) {
          if (overlay.isOpen) {
            overlay.close();
          }
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [anyOpen]);
}
