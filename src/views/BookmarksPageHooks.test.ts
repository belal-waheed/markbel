import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { LocalBookmark } from "../db/db";
import {
  toggleSelection,
  selectAll,
  computeBulkToggleReadState,
  useBookmarkBatchOperations,
} from "../hooks/useBookmarkBatchOperations";
import { BookmarkBatchBar } from "../components/BookmarkBatchBar";
import {
  handleBookmarkShortcut,
  isInputElement,
} from "../hooks/useBookmarkKeyboardShortcuts";
import { bookmarkRepository } from "../db/SyncRepository";
import { syncManager } from "../db/SyncManager";

function createMockBookmark(id: string, overrides: Partial<LocalBookmark> = {}): LocalBookmark {
  return {
    id,
    userId: "test-user",
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
    description: `Description ${id}`,
    image: "",
    group: "Unsorted",
    isPinned: false,
    isArchived: false,
    isRead: false,
    readAt: "",
    remindAt: "",
    version: 1,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("BookmarksPage Hooks & Modular Architecture Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("1. useBookmarkBatchOperations: Selection & Calculations", () => {
    it("toggles selection on and off correctly", () => {
      let set = new Set<string>();

      // Select first
      set = toggleSelection(set, "bm-1");
      expect(set.has("bm-1")).toBe(true);
      expect(set.size).toBe(1);

      // Select second
      set = toggleSelection(set, "bm-2");
      expect(set.has("bm-2")).toBe(true);
      expect(set.size).toBe(2);

      // Deselect first
      set = toggleSelection(set, "bm-1");
      expect(set.has("bm-1")).toBe(false);
      expect(set.has("bm-2")).toBe(true);
      expect(set.size).toBe(1);
    });

    it("selects all bookmarks from a list", () => {
      const bookmarks = [
        createMockBookmark("bm-1"),
        createMockBookmark("bm-2"),
        createMockBookmark("bm-3"),
      ];

      const set = selectAll(bookmarks);
      expect(set.size).toBe(3);
      expect(set.has("bm-1")).toBe(true);
      expect(set.has("bm-2")).toBe(true);
      expect(set.has("bm-3")).toBe(true);
    });

    it("computes bulk toggle read state when all are unread", () => {
      const b1 = createMockBookmark("bm-1", { isRead: false });
      const b2 = createMockBookmark("bm-2", { isRead: false });
      const selected = new Set(["bm-1", "bm-2"]);

      const result = computeBulkToggleReadState([b1, b2], selected);
      expect(result.targetIds).toEqual(["bm-1", "bm-2"]);
      expect(result.newStatus).toBe(true);
      expect(result.readAtTimestamp).not.toBe("");
    });

    it("computes bulk toggle read state when mixed read/unread (marks all as read)", () => {
      const b1 = createMockBookmark("bm-1", { isRead: true });
      const b2 = createMockBookmark("bm-2", { isRead: false });
      const selected = new Set(["bm-1", "bm-2"]);

      const result = computeBulkToggleReadState([b1, b2], selected);
      expect(result.newStatus).toBe(true);
      expect(result.readAtTimestamp).not.toBe("");
    });

    it("computes bulk toggle read state when all are read (marks all as unread)", () => {
      const b1 = createMockBookmark("bm-1", { isRead: true });
      const b2 = createMockBookmark("bm-2", { isRead: true });
      const selected = new Set(["bm-1", "bm-2"]);

      const result = computeBulkToggleReadState([b1, b2], selected);
      expect(result.newStatus).toBe(false);
      expect(result.readAtTimestamp).toBe("");
    });
  });

  describe("2. useBookmarkBatchOperations: Batch Operations Execution", () => {
    it("executes bulk delete, clears selection, syncs, and fires onSynced callback", async () => {
      const bulkDeleteSpy = vi.spyOn(bookmarkRepository, "bulkDelete").mockResolvedValue(undefined as any);
      const syncSpy = vi.spyOn(syncManager, "sync").mockResolvedValue({} as any);
      const onSynced = vi.fn();

      let hookValue: ReturnType<typeof useBookmarkBatchOperations> | null = null;
      function TestComponent() {
        hookValue = useBookmarkBatchOperations();
        return null;
      }
      renderToString(React.createElement(TestComponent));

      expect(hookValue).not.toBeNull();
      hookValue!.selectedIds.add("bm-1");
      hookValue!.selectedIds.add("bm-2");

      await hookValue!.handleBulkDelete(onSynced);

      expect(bulkDeleteSpy).toHaveBeenCalledWith(["bm-1", "bm-2"]);
      expect(syncSpy).toHaveBeenCalledWith(true);
      expect(onSynced).toHaveBeenCalledTimes(1);
    });

    it("executes bulk archive with isArchived: true", async () => {
      const bulkUpdateSpy = vi.spyOn(bookmarkRepository, "bulkUpdate").mockResolvedValue(undefined as any);
      const syncSpy = vi.spyOn(syncManager, "sync").mockResolvedValue({} as any);
      const onSynced = vi.fn();

      let hookValue: ReturnType<typeof useBookmarkBatchOperations> | null = null;
      function TestComponent() {
        hookValue = useBookmarkBatchOperations();
        return null;
      }
      renderToString(React.createElement(TestComponent));

      hookValue!.selectedIds.add("bm-archive-1");
      await hookValue!.handleBulkArchive(onSynced);

      expect(bulkUpdateSpy).toHaveBeenCalledWith(["bm-archive-1"], { isArchived: true });
      expect(syncSpy).toHaveBeenCalledWith(true);
      expect(onSynced).toHaveBeenCalledTimes(1);
    });

    it("executes bulk toggle read status accurately", async () => {
      const bulkUpdateSpy = vi.spyOn(bookmarkRepository, "bulkUpdate").mockResolvedValue(undefined as any);
      const syncSpy = vi.spyOn(syncManager, "sync").mockResolvedValue({} as any);
      const onSynced = vi.fn();

      let hookValue: ReturnType<typeof useBookmarkBatchOperations> | null = null;
      function TestComponent() {
        hookValue = useBookmarkBatchOperations();
        return null;
      }
      renderToString(React.createElement(TestComponent));

      const bm = createMockBookmark("bm-read-1", { isRead: false });
      hookValue!.selectedIds.add("bm-read-1");

      await hookValue!.handleBulkToggleRead([bm], onSynced);

      expect(bulkUpdateSpy).toHaveBeenCalledWith(
        ["bm-read-1"],
        expect.objectContaining({ isRead: true })
      );
      expect(syncSpy).toHaveBeenCalledWith(true);
      expect(onSynced).toHaveBeenCalledTimes(1);
    });

    it("no-ops when selectedIds is empty", async () => {
      const bulkDeleteSpy = vi.spyOn(bookmarkRepository, "bulkDelete").mockResolvedValue(undefined as any);
      const bulkUpdateSpy = vi.spyOn(bookmarkRepository, "bulkUpdate").mockResolvedValue(undefined as any);
      const syncSpy = vi.spyOn(syncManager, "sync").mockResolvedValue({} as any);

      let hookValue: ReturnType<typeof useBookmarkBatchOperations> | null = null;
      function TestComponent() {
        hookValue = useBookmarkBatchOperations();
        return null;
      }
      renderToString(React.createElement(TestComponent));

      await hookValue!.handleBulkDelete();
      await hookValue!.handleBulkArchive();
      await hookValue!.handleBulkToggleRead([]);

      expect(bulkDeleteSpy).not.toHaveBeenCalled();
      expect(bulkUpdateSpy).not.toHaveBeenCalled();
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  describe("3. BookmarkBatchBar Component Rendering", () => {
    it("returns null when selectedCount is 0 or negative", () => {
      const htmlZero = renderToString(
        React.createElement(BookmarkBatchBar, {
          selectedCount: 0,
          onClear: vi.fn(),
          onToggleRead: vi.fn(),
          onArchive: vi.fn(),
          onDelete: vi.fn(),
        })
      );
      expect(htmlZero).toBe("");

      const htmlNegative = renderToString(
        React.createElement(BookmarkBatchBar, {
          selectedCount: -1,
          onClear: vi.fn(),
          onToggleRead: vi.fn(),
          onArchive: vi.fn(),
          onDelete: vi.fn(),
        })
      );
      expect(htmlNegative).toBe("");
    });

    it("renders selection count, clear button, and batch action buttons when selectedCount > 0", () => {
      const rawHtml = renderToString(
        React.createElement(BookmarkBatchBar, {
          selectedCount: 4,
          onClear: vi.fn(),
          onToggleRead: vi.fn(),
          onArchive: vi.fn(),
          onDelete: vi.fn(),
        })
      );
      const html = rawHtml.replace(/<!-- -->/g, "");

      expect(html).toContain("4 Selected");
      expect(html).toContain("Clear");
      expect(html).toContain("Toggle Read");
      expect(html).toContain("Archive");
      expect(html).toContain("Delete");
      expect(html).toContain('role="toolbar"');
    });
  });

  describe("4. useBookmarkKeyboardShortcuts & Input Guards", () => {
    it("correctly identifies editable DOM elements", () => {
      expect(isInputElement(null)).toBe(false);
      expect(isInputElement({ tagName: "DIV", isContentEditable: false } as any)).toBe(false);
      expect(isInputElement({ tagName: "INPUT", isContentEditable: false } as any)).toBe(true);
      expect(isInputElement({ tagName: "TEXTAREA", isContentEditable: false } as any)).toBe(true);
      expect(isInputElement({ tagName: "SELECT", isContentEditable: false } as any)).toBe(true);
      expect(isInputElement({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
    });

    it("focuses search input on '/' key", () => {
      const focusSpy = vi.fn();
      const preventDefault = vi.fn();
      const mockInput = { focus: focusSpy } as any;
      const ref = { current: mockInput };

      const event = {
        key: "/",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        searchInputRef: ref,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it("opens Add Bookmark modal on 'n' or 'N' key", () => {
      const preventDefault = vi.fn();
      const onOpenAddModal = vi.fn();

      const eventN = {
        key: "n",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(eventN, {
        onOpenAddModal,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onOpenAddModal).toHaveBeenCalled();

      // Test uppercase 'N'
      const eventUpperN = {
        key: "N",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      const handledUpper = handleBookmarkShortcut(eventUpperN, {
        onOpenAddModal,
      });
      expect(handledUpper).toBe(true);
    });

    it("clears multiselect on Escape when isSelectionMode is true", () => {
      const preventDefault = vi.fn();
      const onClearSelection = vi.fn();

      const event = {
        key: "Escape",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        isSelectionMode: true,
        onClearSelection,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onClearSelection).toHaveBeenCalled();
    });

    it("blurs search input on Escape when search input is focused", () => {
      const blurSpy = vi.fn();
      const mockInput = { blur: blurSpy, tagName: "INPUT" };
      const ref = { current: mockInput as any };

      vi.stubGlobal("document", {
        activeElement: mockInput,
      });

      const preventDefault = vi.fn();
      const event = {
        key: "Escape",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        searchInputRef: ref,
        isSelectionMode: false,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(blurSpy).toHaveBeenCalled();
    });

    it("toggles select on focused item via 'x'", () => {
      const preventDefault = vi.fn();
      const onToggleSelect = vi.fn();
      const bookmark = createMockBookmark("bm-focused");

      const event = {
        key: "x",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        focusedIndex: 0,
        bookmarks: [bookmark],
        onToggleSelect,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onToggleSelect).toHaveBeenCalledWith(bookmark);
    });

    it("archives selected items via 'd' when in selection mode", () => {
      const preventDefault = vi.fn();
      const onBulkArchive = vi.fn();

      const event = {
        key: "d",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        isSelectionMode: true,
        onBulkArchive,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onBulkArchive).toHaveBeenCalled();
    });

    it("archives focused item via 'd' when not in selection mode", () => {
      const preventDefault = vi.fn();
      const onArchive = vi.fn();
      const bookmark = createMockBookmark("bm-focused");

      const event = {
        key: "d",
        preventDefault,
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        isSelectionMode: false,
        focusedIndex: 0,
        bookmarks: [bookmark],
        onArchive,
      });

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onArchive).toHaveBeenCalledWith(bookmark);
    });

    it("guards against input typing (does not trigger shortcuts when inside input)", () => {
      vi.stubGlobal("document", {
        activeElement: { tagName: "INPUT", isContentEditable: false },
      });

      const onOpenAddModal = vi.fn();
      const event = {
        key: "n",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      const handled = handleBookmarkShortcut(event, {
        onOpenAddModal,
      });

      expect(handled).toBe(false);
      expect(onOpenAddModal).not.toHaveBeenCalled();
    });

    it("guards against active modal overlays (does not trigger shortcuts when hasOpenModal is true)", () => {
      const onOpenAddModal = vi.fn();
      const onClearSelection = vi.fn();

      const eventN = {
        key: "n",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      const handledN = handleBookmarkShortcut(eventN, {
        hasOpenModal: true,
        onOpenAddModal,
      });
      expect(handledN).toBe(false);
      expect(onOpenAddModal).not.toHaveBeenCalled();

      // Escape should also not be intercepted when modal is open
      const eventEsc = {
        key: "Escape",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      const handledEsc = handleBookmarkShortcut(eventEsc, {
        hasOpenModal: true,
        isSelectionMode: true,
        onClearSelection,
      });
      expect(handledEsc).toBe(false);
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it("guards against browser modifier keys (Ctrl, Meta, Alt)", () => {
      const onOpenAddModal = vi.fn();
      const onBulkArchive = vi.fn();

      // Ctrl + N
      const handledCtrlN = handleBookmarkShortcut(
        { key: "n", ctrlKey: true, preventDefault: vi.fn() } as any,
        { onOpenAddModal }
      );
      expect(handledCtrlN).toBe(false);

      // Meta + D
      const handledMetaD = handleBookmarkShortcut(
        { key: "d", metaKey: true, preventDefault: vi.fn() } as any,
        { isSelectionMode: true, onBulkArchive }
      );
      expect(handledMetaD).toBe(false);

      // Alt + X
      const handledAltX = handleBookmarkShortcut(
        { key: "x", altKey: true, preventDefault: vi.fn() } as any,
        { onToggleSelectFocused: vi.fn() }
      );
      expect(handledAltX).toBe(false);
    });

    it("respects enabled: false flag", () => {
      const onOpenAddModal = vi.fn();
      const handled = handleBookmarkShortcut(
        { key: "n", preventDefault: vi.fn() } as any,
        { enabled: false, onOpenAddModal }
      );
      expect(handled).toBe(false);
      expect(onOpenAddModal).not.toHaveBeenCalled();
    });
  });
});
