import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalBookmark } from "../db/db";
import { syncManager } from "../db/SyncManager";
import { bookmarkRepository, groupRepository } from "../db/SyncRepository";
import { useAuth } from "../lib/auth";
import { useDebounce } from "../lib/useDebounce";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { useSwipeGesture } from "../lib/useSwipeGesture";
import { useModalBackNavigation } from "../lib/useModalBackNavigation";
import { GroupSidebar } from "../components/GroupSidebar";
import { BookmarkCard } from "../components/BookmarkCard";
import { BookmarkFilterBar, FilterTab, ViewMode } from "../components/BookmarkFilterBar";
import { AddBookmarkModal } from "../components/modals/AddBookmarkModal";
import { EditBookmarkModal } from "../components/modals/EditBookmarkModal";
import { ArchiveModal } from "../components/modals/ArchiveModal";
import { DeleteModal } from "../components/modals/DeleteModal";
import { GroupModal } from "../components/modals/GroupModal";
import { Plus, Menu, RefreshCw, BookmarkX, X, WifiOff } from "lucide-react";
import MarkbelLogo from "../components/MarkbelLogo";

export default function BookmarksPage() {
  const { logout, isGuest, user } = useAuth();

  // Network Connectivity State
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncManager.sync(true);
    };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => {
      if (!document.hidden) {
        syncManager.sync(true);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    // Initial mount sync pull
    syncManager.sync(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  // Reactive Dexie Live Queries
  const bookmarks =
    useLiveQuery(
      () => db.bookmarks.filter((b) => !b.deletedAt && !b.isArchived).toArray(),
      []
    ) || [];

  const dbGroups =
    useLiveQuery(
      () => db.groups.filter((g) => !g.deletedAt).toArray(),
      []
    ) || [];

  // Filter & UI States
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("markbel_view_mode") as ViewMode) || "grid";
    }
    return "grid";
  });
  const [showGuestBanner, setShowGuestBanner] = useState(true);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("markbel_view_mode", mode);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Full-screen mobile swipe gestures
  useSwipeGesture({
    onSwipeRight: () => setIsSidebarOpen(true),
    onSwipeLeft: () => setIsSidebarOpen(false),
    minDistance: 45,
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<LocalBookmark | null>(null);
  const [archivingBookmark, setArchivingBookmark] = useState<LocalBookmark | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<LocalBookmark | null>(null);
  const [groupModalState, setGroupModalState] = useState<{
    isOpen: boolean;
    initialName?: string;
  }>({ isOpen: false });

  // Trap browser & Android Back button navigation when overlays are open
  useModalBackNavigation([
    { isOpen: Boolean(deletingBookmark), close: () => setDeletingBookmark(null) },
    { isOpen: Boolean(archivingBookmark), close: () => setArchivingBookmark(null) },
    { isOpen: groupModalState.isOpen, close: () => setGroupModalState({ isOpen: false }) },
    { isOpen: Boolean(editingBookmark), close: () => setEditingBookmark(null) },
    { isOpen: isAddModalOpen, close: () => setIsAddModalOpen(false) },
    { isOpen: isSidebarOpen, close: () => setIsSidebarOpen(false) },
  ]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useKeyboardShortcuts([
    {
      key: "/",
      preventInputFocus: false,
      handler: (e) => {
        if (searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
        }
      },
    },
    {
      key: "n",
      preventInputFocus: true,
      handler: () => {
        setIsAddModalOpen(true);
      },
    },
  ]);

  // Group names list for selectors
  const groupNames = useMemo(() => {
    const set = new Set<string>(["Unsorted"]);
    dbGroups.forEach((g) => set.add(g.name));
    bookmarks.forEach((b) => {
      if (b.group) set.add(b.group);
    });
    return Array.from(set);
  }, [dbGroups, bookmarks]);

  // Tab Stats Counts (Computed locally in O(N))
  const counts = useMemo(() => {
    const now = new Date().toISOString();
    let unread = 0;
    let pinned = 0;
    let due = 0;

    bookmarks.forEach((b) => {
      if (!b.isRead) unread++;
      if (b.isPinned) pinned++;
      if (b.remindAt && b.remindAt <= now && !b.isRead) due++;
    });

    return {
      all: bookmarks.length,
      unread,
      pinned,
      due,
    };
  }, [bookmarks]);

  // Filtered & Sorted Bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;

    // Filter by Group
    if (activeGroup) {
      result = result.filter((b) => (b.group || "Unsorted") === activeGroup);
    }

    // Filter by Tab
    if (currentTab === "unread") {
      result = result.filter((b) => !b.isRead);
    } else if (currentTab === "pinned") {
      result = result.filter((b) => b.isPinned);
    } else if (currentTab === "due") {
      const now = new Date().toISOString();
      result = result.filter((b) => b.remindAt && b.remindAt <= now && !b.isRead);
    }

    // Filter by Search Query
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || "").toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          (b.group || "").toLowerCase().includes(q)
      );
    }

    // Sort: Pinned first, then newest first
    return [...result].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [bookmarks, activeGroup, currentTab, debouncedSearchQuery]);

  // Manual Trigger Sync
  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await syncManager.sync(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Card Handlers
  const handleCardClick = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleTogglePin = useCallback(async (b: LocalBookmark) => {
    await bookmarkRepository.update(b.id, { isPinned: !b.isPinned });
    syncManager.sync(true);
  }, []);

  const handleToggleRead = useCallback(async (b: LocalBookmark) => {
    const isRead = !b.isRead;
    await bookmarkRepository.update(b.id, {
      isRead,
      readAt: isRead ? new Date().toISOString() : "",
    });
    syncManager.sync(true);
  }, []);

  const handleAddBookmark = async (data: {
    url: string;
    title: string;
    description: string;
    image: string;
    group: string;
    remindAt?: string;
    isPinned?: boolean;
  }) => {
    await bookmarkRepository.create({
      id: crypto.randomUUID(),
      userId: user?.id || "local-user",
      ...data,
    });
    syncManager.sync(true);
  };

  const handleEditBookmark = async (id: string, updates: Partial<LocalBookmark>) => {
    await bookmarkRepository.update(id, updates);
    syncManager.sync(true);
  };

  const handleDeleteBookmark = async (id: string) => {
    await bookmarkRepository.delete(id);
    setDeletingBookmark(null);
    syncManager.sync(true);
  };

  const handleArchiveBookmark = async (id: string, archiveGroup?: string) => {
    await bookmarkRepository.update(id, {
      isArchived: true,
      archiveGroup: archiveGroup || "",
    });
    setArchivingBookmark(null);
    syncManager.sync(true);
  };

  // Group Handlers
  const handleOpenNewGroup = () => {
    setGroupModalState({ isOpen: true });
  };

  const handleOpenEditGroup = (name: string) => {
    setGroupModalState({ isOpen: true, initialName: name });
  };

  const handleSaveGroup = async (name: string, oldName?: string) => {
    if (oldName) {
      const existing = dbGroups.find((g) => g.name === oldName);
      if (existing) {
        await groupRepository.update(existing.id, { name });
      }
    } else {
      await groupRepository.create({
        id: crypto.randomUUID(),
        userId: user?.id || "local-user",
        name,
        color: "blue",
      });
    }
    syncManager.sync(true);
  };

  const handleDeleteGroup = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete group "${name}"? Bookmarks will move to Unsorted.`)) {
      const existing = dbGroups.find((g) => g.name === name);
      if (existing) {
        await groupRepository.delete(existing.id);
      }
      const groupBookmarks = bookmarks.filter((b) => b.group === name);
      for (const b of groupBookmarks) {
        await bookmarkRepository.update(b.id, { group: "Unsorted" });
      }
      if (activeGroup === name) {
        setActiveGroup(null);
      }
      syncManager.sync(true);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-default)] font-sans">
      {/* Sidebar Navigation */}
      <GroupSidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeGroup={activeGroup}
        setActiveGroup={setActiveGroup}
        bookmarks={bookmarks}
        dbGroups={dbGroups}
        logout={logout}
        openEditGroup={handleOpenEditGroup}
        deleteGroup={handleDeleteGroup}
        openNewGroup={handleOpenNewGroup}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-zinc-800 text-zinc-200 border-b border-zinc-700 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Offline Mode Active. Local changes will sync automatically when reconnected.</span>
          </div>
        )}

        {/* Guest Mode Notice Banner */}
        {isGuest && showGuestBanner && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 sm:px-6 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)] min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">
                <strong>Local Storage Active:</strong> Bookmarks are saved on this device. Sign in or create a free account to back up and sync across devices.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/login"
                className="btn-primary text-xs px-2.5 py-1 font-bold rounded shadow-xs"
              >
                Sign In / Sync
              </a>
              <button
                onClick={() => setShowGuestBanner(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 rounded"
                title="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="flex-none h-16 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] active:scale-95 rounded-lg transition-all"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <MarkbelLogo size={24} />
              <h1 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
                Markbel
              </h1>
            </div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate hidden md:block">
              {activeGroup ? activeGroup : "All Bookmarks"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isGuest && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                title="Sync Now"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Bookmark</span>
            </button>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 lg:p-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Filter Bar & Search */}
            <BookmarkFilterBar
              currentTab={currentTab}
              onTabChange={setCurrentTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              counts={counts}
              searchInputRef={searchInputRef}
            />

            {/* Bookmarks Grid / List / Empty State */}
            {filteredBookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
                  <BookmarkX className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
                  No bookmarks found
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] max-w-xs mb-4">
                  {debouncedSearchQuery
                    ? `No matches found for "${debouncedSearchQuery}".`
                    : activeGroup
                    ? `No bookmarks in group "${activeGroup}".`
                    : "Your vault is empty. Click below to add your first link!"}
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn-primary px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Link
                </button>
              </div>
            ) : viewMode === "list" ? (
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {filteredBookmarks.map((b) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    viewMode="list"
                    onClick={handleCardClick}
                    onTogglePin={handleTogglePin}
                    onToggleRead={handleToggleRead}
                    onArchive={(bookmark) => setArchivingBookmark(bookmark)}
                    onEdit={(bookmark) => setEditingBookmark(bookmark)}
                    onDelete={(bookmark) => setDeletingBookmark(bookmark)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
                {filteredBookmarks.map((b) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    viewMode="grid"
                    onClick={handleCardClick}
                    onTogglePin={handleTogglePin}
                    onToggleRead={handleToggleRead}
                    onArchive={(bookmark) => setArchivingBookmark(bookmark)}
                    onEdit={(bookmark) => setEditingBookmark(bookmark)}
                    onDelete={(bookmark) => setDeletingBookmark(bookmark)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button (Mobile FAB) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 bg-[var(--color-accent)] text-white p-3.5 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center active:scale-95 transition-all"
        title="Add Bookmark (N)"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Modals */}
      <AddBookmarkModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddBookmark}
        groups={groupNames}
      />

      <EditBookmarkModal
        isOpen={!!editingBookmark}
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
        onSave={handleEditBookmark}
        groups={groupNames}
      />

      <ArchiveModal
        isOpen={!!archivingBookmark}
        bookmark={archivingBookmark}
        onClose={() => setArchivingBookmark(null)}
        onConfirm={handleArchiveBookmark}
      />

      <DeleteModal
        isOpen={!!deletingBookmark}
        bookmark={deletingBookmark}
        onClose={() => setDeletingBookmark(null)}
        onConfirm={handleDeleteBookmark}
      />

      <GroupModal
        isOpen={groupModalState.isOpen}
        initialName={groupModalState.initialName}
        onClose={() => setGroupModalState({ isOpen: false })}
        onSave={handleSaveGroup}
      />
    </div>
  );
}
