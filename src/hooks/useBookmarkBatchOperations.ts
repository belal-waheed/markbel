import { useState, useCallback } from "react";
import { LocalBookmark } from "../db/db";
import { bookmarkRepository } from "../db/SyncRepository";
import { syncManager } from "../db/SyncManager";

export interface BookmarkBatchOperations {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  selectedCount: number;
  handleToggleSelect: (bookmark: LocalBookmark, shiftKey?: boolean) => void;
  handleSelectAll: (bookmarks: LocalBookmark[]) => void;
  handleClearSelection: () => void;
  handleBulkDelete: (onSynced?: () => void) => Promise<void>;
  handleBulkArchive: (onSynced?: () => void) => Promise<void>;
  handleBulkToggleRead: (filteredBookmarks: LocalBookmark[], onSynced?: () => void) => Promise<void>;
  handleBulkMoveGroup: (targetGroup: string, onSynced?: () => void) => Promise<void>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function toggleSelection(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function selectAll(bookmarks: Array<{ id: string }>): Set<string> {
  const next = new Set<string>();
  bookmarks.forEach((b) => next.add(b.id));
  return next;
}

export function computeBulkToggleReadState(
  filteredBookmarks: LocalBookmark[],
  selectedIds: Set<string>
): { targetIds: string[]; newStatus: boolean; readAtTimestamp: string } {
  const targetIds = Array.from(selectedIds);
  const selectedList = filteredBookmarks.filter((b) => selectedIds.has(b.id));
  const allRead = selectedList.length > 0 && selectedList.every((b) => b.isRead);
  const newStatus = !allRead;
  const readAtTimestamp = newStatus ? new Date().toISOString() : "";
  return { targetIds, newStatus, readAtTimestamp };
}

export async function handleBulkMoveGroup(
  selectedIds: Set<string>,
  targetGroup: string,
  onSuccess?: () => void
): Promise<void> {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  await bookmarkRepository.bulkUpdate(ids, { group: targetGroup });
  await syncManager.sync(true);
  onSuccess?.();
}

export function useBookmarkBatchOperations(): BookmarkBatchOperations {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const isSelectionMode = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  const handleToggleSelect = useCallback((bookmark: LocalBookmark, _shiftKey?: boolean) => {
    setSelectedIds((prev) => toggleSelection(prev, bookmark.id));
  }, []);

  const handleSelectAll = useCallback((bookmarks: LocalBookmark[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      bookmarks.forEach((b) => next.add(b.id));
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(
    async (onSynced?: () => void): Promise<void> => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      await bookmarkRepository.bulkDelete(ids);
      handleClearSelection();
      await syncManager.sync(true);
      onSynced?.();
    },
    [selectedIds, handleClearSelection]
  );

  const handleBulkArchive = useCallback(
    async (onSynced?: () => void): Promise<void> => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      await bookmarkRepository.bulkUpdate(ids, { isArchived: true });
      handleClearSelection();
      await syncManager.sync(true);
      onSynced?.();
    },
    [selectedIds, handleClearSelection]
  );

  const handleBulkToggleRead = useCallback(
    async (filteredBookmarks: LocalBookmark[], onSynced?: () => void): Promise<void> => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const { newStatus, readAtTimestamp } = computeBulkToggleReadState(filteredBookmarks, selectedIds);
      await bookmarkRepository.bulkUpdate(ids, {
        isRead: newStatus,
        readAt: readAtTimestamp,
      });
      handleClearSelection();
      await syncManager.sync(true);
      onSynced?.();
    },
    [selectedIds, handleClearSelection]
  );

  const handleBulkMoveGroupCallback = useCallback(
    async (targetGroup: string, onSynced?: () => void): Promise<void> => {
      await handleBulkMoveGroup(selectedIds, targetGroup, () => {
        handleClearSelection();
        onSynced?.();
      });
    },
    [selectedIds, handleClearSelection]
  );

  return {
    selectedIds,
    isSelectionMode,
    selectedCount,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkToggleRead,
    handleBulkMoveGroup: handleBulkMoveGroupCallback,
    setSelectedIds,
  };
}
