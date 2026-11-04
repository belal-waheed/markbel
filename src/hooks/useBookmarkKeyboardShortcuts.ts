import { useEffect } from "react";
import { LocalBookmark } from "../db/db";

export interface UseBookmarkKeyboardShortcutsOptions {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onOpenAddModal?: () => void;
  onOpenCommandPalette?: () => void;
  isSelectionMode?: boolean;
  onClearSelection?: () => void;
  focusedIndex?: number | null;
  bookmarks?: LocalBookmark[];
  onToggleSelect?: (bookmark: LocalBookmark) => void;
  onToggleSelectFocused?: () => void;
  onArchive?: (bookmark: LocalBookmark) => void;
  onBulkArchive?: () => void;
  onArchiveFocusedOrSelected?: () => void;
  hasOpenModal?: boolean;
  enabled?: boolean;
}

export function isInputElement(el: Element | null): boolean {
  if (!el) return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if ((el as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
}

export function handleBookmarkShortcut(
  e: KeyboardEvent,
  options: UseBookmarkKeyboardShortcutsOptions
): boolean {
  if (options.enabled === false) return false;
  if (e.defaultPrevented) return false;

  const key = e.key;

  // Escape handling:
  // If a modal overlay is open, we do not intercept Escape (let modal/browser back navigation handle it)
  if (key === "Escape" || key === "Esc") {
    if (options.hasOpenModal) {
      return false;
    }
    if (options.isSelectionMode) {
      e.preventDefault();
      options.onClearSelection?.();
      return true;
    }
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active && (active === options.searchInputRef?.current || isInputElement(active))) {
      e.preventDefault();
      (active as HTMLElement).blur();
      return true;
    }
    return false;
  }

  // Cmd+K / Ctrl+K : Universal Command Palette shortcut
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    options.onOpenCommandPalette?.();
    return true;
  }

  // Modifier guard: do not intercept shortcuts with Ctrl, Meta, or Alt
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return false;
  }

  // If a modal overlay is open, do not intercept regular shortcuts
  if (options.hasOpenModal) {
    return false;
  }

  const active = typeof document !== "undefined" ? document.activeElement : null;
  const inInput = isInputElement(active);

  // If user is currently typing in an input/textarea/select/contentEditable
  if (inInput) {
    return false;
  }

  // '/' : Focus search input
  if (key === "/") {
    if (options.searchInputRef?.current) {
      e.preventDefault();
      options.searchInputRef.current.focus();
      return true;
    }
    return false;
  }

  // 'n' or 'N' : Open Add Bookmark modal
  if (key.toLowerCase() === "n") {
    e.preventDefault();
    options.onOpenAddModal?.();
    return true;
  }

  // 'x' or 'X' : Toggle select on focused item
  if (key.toLowerCase() === "x") {
    e.preventDefault();
    if (options.onToggleSelectFocused) {
      options.onToggleSelectFocused();
      return true;
    }
    if (
      options.focusedIndex != null &&
      options.focusedIndex >= 0 &&
      options.bookmarks &&
      options.bookmarks[options.focusedIndex] &&
      options.onToggleSelect
    ) {
      options.onToggleSelect(options.bookmarks[options.focusedIndex]);
      return true;
    }
    return false;
  }

  // 'd' or 'D' : Archive selected or focused bookmark
  if (key.toLowerCase() === "d") {
    e.preventDefault();
    if (options.onArchiveFocusedOrSelected) {
      options.onArchiveFocusedOrSelected();
      return true;
    }
    if (options.isSelectionMode && options.onBulkArchive) {
      options.onBulkArchive();
      return true;
    }
    if (
      options.focusedIndex != null &&
      options.focusedIndex >= 0 &&
      options.bookmarks &&
      options.bookmarks[options.focusedIndex] &&
      options.onArchive
    ) {
      options.onArchive(options.bookmarks[options.focusedIndex]);
      return true;
    }
    return false;
  }

  return false;
}

export function useBookmarkKeyboardShortcuts(
  options: UseBookmarkKeyboardShortcutsOptions
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleBookmarkShortcut(e, options);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    options.enabled,
    options.hasOpenModal,
    options.isSelectionMode,
    options.focusedIndex,
    options.bookmarks,
    options.onOpenAddModal,
    options.onClearSelection,
    options.onToggleSelect,
    options.onToggleSelectFocused,
    options.onArchive,
    options.onBulkArchive,
    options.onArchiveFocusedOrSelected,
    options.searchInputRef,
  ]);
}
