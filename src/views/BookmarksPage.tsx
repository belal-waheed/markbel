import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalBookmark, initializeDefaultSmartGroups, autoOrganizeUnsortedBookmarks, deduplicateLocalGroups } from "../db/db";
import { syncManager } from "../db/SyncManager";
import { SyncState } from "../sync";
import { bookmarkRepository, groupRepository } from "../db/SyncRepository";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useDebounce } from "../lib/useDebounce";
import { useSwipeGesture } from "../lib/useSwipeGesture";
import { useModalBackNavigation } from "../lib/useModalBackNavigation";
import { useBookmarkBatchOperations } from "../hooks/useBookmarkBatchOperations";
import { useBookmarkKeyboardShortcuts } from "../hooks/useBookmarkKeyboardShortcuts";
import { BookmarkBatchBar } from "../components/BookmarkBatchBar";
import { GroupSidebar } from "../components/GroupSidebar";
import { BookmarkCard } from "../components/BookmarkCard";
import { BookmarkFilterBar, FilterTab, ViewMode, SortOption } from "../components/BookmarkFilterBar";
import { CategoryPillBar } from "../components/CategoryPillBar";
import { getPinnedCategories, togglePinnedCategory } from "../lib/homeCategories";
import { filterAndRankBookmarks } from "../lib/searchCatalog";
import { parseSeriesProgression, formatEpisodicBadge } from "../lib/seriesProgression";
import { syncCompletedBookmarkToTickTick } from "../lib/ticktickSync";
import {
  getNavigationPreferences,
  NavigationPreferences,
} from "../lib/navigationPreferences";
import { AddBookmarkModal } from "../components/modals/AddBookmarkModal";
import { EditBookmarkModal } from "../components/modals/EditBookmarkModal";
import { ArchiveModal } from "../components/modals/ArchiveModal";
import { DeleteModal } from "../components/modals/DeleteModal";
import { GroupModal } from "../components/modals/GroupModal";
import { ReaderModal } from "../components/modals/ReaderModal";
import { CommandPalette } from "../components/modals/CommandPalette";
import { Plus, Menu, RefreshCw, BookmarkX, X, WifiOff } from "lucide-react";
import MarkbelLogo from "../components/MarkbelLogo";

export default function BookmarksPage() {
  const navigate = useNavigate();
  const { logout, isGuest, user } = useAuth();
  const { showToast } = useToast();

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

    // BroadcastChannel & SyncState listener for SYNC_COMPLETED events
    let syncChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        syncChannel = new BroadcastChannel("markbel-sync-channel");
        syncChannel.onmessage = (event) => {
          if (event.data?.type === "SYNC_COMPLETED") {
            autoOrganizeUnsortedBookmarks(user?.id || "local-user");
          }
        };
      } catch {}
    }

    const unsubSync = syncManager.subscribe((state) => {
      if (state === SyncState.Idle) {
        autoOrganizeUnsortedBookmarks(user?.id || "local-user");
      }
    });

    // Initial mount: self-heal duplicate groups, init default smart groups, auto-organize unsorted, sync pull
    deduplicateLocalGroups().finally(async () => {
      await initializeDefaultSmartGroups(user?.id || "local-user");
      await autoOrganizeUnsortedBookmarks(user?.id || "local-user");
      syncManager.sync(true);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      if (syncChannel) {
        try {
          syncChannel.close();
        } catch {}
      }
      unsubSync();
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

  // Navigation & Workspace Preferences
  const [navPrefs, setNavPrefs] = useState<NavigationPreferences>(() =>
    getNavigationPreferences()
  );

  useEffect(() => {
    const handlePrefsChanged = (e: any) => {
      if (e.detail) {
        setNavPrefs(e.detail);
        if (Array.isArray(e.detail.pinnedGroupNames)) {
          setPinnedCategoryNames(e.detail.pinnedGroupNames);
        }
      }
    };
    window.addEventListener("markbel_nav_preferences_changed", handlePrefsChanged);
    return () => {
      window.removeEventListener("markbel_nav_preferences_changed", handlePrefsChanged);
    };
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  // Filter & UI States (respect URL query params first, fallback to navigation preferences)
  const [activeGroup, setActiveGroup] = useState<string | null>(() => {
    const param = searchParams.get("group");
    if (param !== null) {
      return param || null;
    }
    const prefs = getNavigationPreferences();
    if (prefs.defaultView.startsWith("group:")) {
      return prefs.defaultView.slice(6);
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<FilterTab>(() => {
    const VALID_TABS: FilterTab[] = ["all", "unread", "pinned", "due"];
    const param = searchParams.get("tab");
    if (param && (VALID_TABS as readonly string[]).includes(param)) {
      return param as FilterTab;
    }
    const prefs = getNavigationPreferences();
    if (["unread", "pinned", "due"].includes(prefs.defaultView)) {
      return prefs.defaultView as FilterTab;
    }
    return "all";
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get("q") || "");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  // Group & Tab Navigation Handlers (Push to history)
  const handleGroupChange = useCallback((newGroup: string | null) => {
    setActiveGroup(newGroup);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newGroup) {
        next.set("group", newGroup);
      } else {
        next.delete("group");
      }
      return next;
    });
  }, [setSearchParams]);

  const handleTabChange = useCallback((newTab: FilterTab) => {
    setCurrentTab(newTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTab && newTab !== "all") {
        next.set("tab", newTab);
      } else {
        next.delete("tab");
      }
      return next;
    });
  }, [setSearchParams]);

  // Sync debounced search query to URL with replace: true (no spamming history entries)
  useEffect(() => {
    const urlQ = searchParams.get("q") || "";
    const trimmed = debouncedSearchQuery.trim();
    if (trimmed !== urlQ) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (trimmed) {
          next.set("q", trimmed);
        } else {
          next.delete("q");
        }
        return next;
      }, { replace: true });
    }
  }, [debouncedSearchQuery, searchParams, setSearchParams]);

  // Synchronize state with browser Back/Forward navigation changes
  useEffect(() => {
    const VALID_TABS: FilterTab[] = ["all", "unread", "pinned", "due"];

    // 1. Group sync
    const urlGroup = searchParams.get("group");
    if (urlGroup !== null) {
      const resolved = urlGroup || null;
      setActiveGroup((prev) => (prev !== resolved ? resolved : prev));
    } else {
      const prefs = getNavigationPreferences();
      const fallback = prefs.defaultView.startsWith("group:")
        ? prefs.defaultView.slice(6)
        : null;
      setActiveGroup((prev) => (prev !== fallback ? fallback : prev));
    }

    // 2. Tab sync
    const urlTab = searchParams.get("tab");
    if (urlTab && (VALID_TABS as readonly string[]).includes(urlTab)) {
      const resolvedTab = urlTab as FilterTab;
      setCurrentTab((prev) => (prev !== resolvedTab ? resolvedTab : prev));
    } else {
      const prefs = getNavigationPreferences();
      const fallbackTab: FilterTab = ["unread", "pinned", "due"].includes(prefs.defaultView)
        ? (prefs.defaultView as FilterTab)
        : "all";
      setCurrentTab((prev) => (prev !== fallbackTab ? fallbackTab : prev));
    }

    // 3. Search query sync
    const urlQ = searchParams.get("q") || "";
    setSearchQuery((prev) => (prev !== urlQ ? urlQ : prev));
  }, [searchParams]);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("markbel_view_mode") as ViewMode) || "grid";
    }
    return "grid";
  });
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [showGuestBanner, setShowGuestBanner] = useState(true);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("markbel_view_mode", mode);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pinnedCategoryNames, setPinnedCategoryNames] = useState<string[]>(() =>
    getPinnedCategories()
  );

  const handleToggleCategoryPin = useCallback((name: string) => {
    const updated = togglePinnedCategory(name);
    setPinnedCategoryNames(updated);
  }, []);

  // Multiselect State & Batch Operations
  const {
    selectedIds,
    isSelectionMode,
    handleToggleSelect,
    handleClearSelection,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkToggleRead,
    handleBulkMoveGroup,
  } = useBookmarkBatchOperations();

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
  const [readingBookmark, setReadingBookmark] = useState<LocalBookmark | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [groupModalState, setGroupModalState] = useState<{
    isOpen: boolean;
    initialName?: string;
  }>({ isOpen: false });

  // Trap browser & Android Back button navigation when overlays are open
  useModalBackNavigation([
    { isOpen: isCommandPaletteOpen, close: () => setIsCommandPaletteOpen(false) },
    { isOpen: Boolean(readingBookmark), close: () => setReadingBookmark(null) },
    { isOpen: Boolean(deletingBookmark), close: () => setDeletingBookmark(null) },
    { isOpen: Boolean(archivingBookmark), close: () => setArchivingBookmark(null) },
    { isOpen: groupModalState.isOpen, close: () => setGroupModalState({ isOpen: false }) },
    { isOpen: Boolean(editingBookmark), close: () => setEditingBookmark(null) },
    { isOpen: isAddModalOpen, close: () => setIsAddModalOpen(false) },
    { isOpen: isSidebarOpen, close: () => setIsSidebarOpen(false) },
  ]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group names list for selectors
  const groupNames = useMemo(() => {
    const set = new Set<string>(["Unsorted"]);
    dbGroups.forEach((g) => set.add(g.name));
    bookmarks.forEach((b) => {
      if (b.group) set.add(b.group);
    });
    return Array.from(set);
  }, [dbGroups, bookmarks]);

  // Merged category groups with counts (excluding Unsorted)
  const mergedGroups = useMemo(() => {
    const map = new Map<string, number>();
    dbGroups.forEach((g) => {
      if (g.name !== "Unsorted") map.set(g.name, 0);
    });
    bookmarks.forEach((b) => {
      const g = b.group || "Unsorted";
      if (g !== "Unsorted") map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bookmarks, dbGroups]);

  // Tab Stats Counts (Computed locally in O(N))
  const counts = useMemo(() => {
    const now = new Date().toISOString();
    let unread = 0;
    let pinned = 0;
    let due = 0;
    let videos = 0;
    let articles = 0;
    let code = 0;

    bookmarks.forEach((b) => {
      if (!b.isRead) unread++;
      if (b.isPinned) pinned++;
      if (b.remindAt && b.remindAt <= now && !b.isRead) due++;
      if (
        b.contentType === "video" ||
        b.contentType === "playlist" ||
        b.url.includes("youtube.com") ||
        b.url.includes("youtu.be")
      ) {
        videos++;
      }
      if (b.contentType === "article" || Boolean(b.articleContent)) {
        articles++;
      }
      if (b.url.includes("github.com") || b.url.includes("gitlab.com")) {
        code++;
      }
    });

    return {
      all: bookmarks.length,
      unread,
      pinned,
      due,
      videos,
      articles,
      code,
    };
  }, [bookmarks]);

  // Filtered & Sorted Bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;

    // Filter by Group or Special Filter
    if (activeGroup === "__broken__") {
      result = result.filter((b) => b.isBroken);
    } else if (activeGroup === "__media_video__") {
      result = result.filter(
        (b) =>
          b.contentType === "video" ||
          b.contentType === "playlist" ||
          b.url.includes("youtube.com") ||
          b.url.includes("youtu.be")
      );
    } else if (activeGroup === "__media_article__") {
      result = result.filter((b) => b.contentType === "article" || Boolean(b.articleContent));
    } else if (activeGroup === "__media_code__") {
      result = result.filter((b) => b.url.includes("github.com") || b.url.includes("gitlab.com"));
    } else if (activeGroup === "__media_social__") {
      result = result.filter(
        (b) =>
          b.url.includes("twitter.com") ||
          b.url.includes("x.com") ||
          b.url.includes("instagram.com") ||
          b.url.includes("reddit.com")
      );
    } else {
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
      } else if (currentTab === "videos") {
        result = result.filter(
          (b) =>
            b.contentType === "video" ||
            b.contentType === "playlist" ||
            b.url.includes("youtube.com") ||
            b.url.includes("youtu.be")
        );
      } else if (currentTab === "articles") {
        result = result.filter((b) => b.contentType === "article" || Boolean(b.articleContent));
      } else if (currentTab === "code") {
        result = result.filter((b) => b.url.includes("github.com") || b.url.includes("gitlab.com"));
      }
    }

    // Filter and Rank by Search Query using Unified Search Catalog
    if (debouncedSearchQuery.trim()) {
      return filterAndRankBookmarks(result, debouncedSearchQuery, undefined, 0);
    }

    // Sort: Respect user sortOption (Newest, Oldest, Title A-Z, Reading Time)
    return [...result].sort((a, b) => {
      if (sortOption === "newest") {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === "oldest") {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortOption === "alpha") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortOption === "readtime") {
        return (b.readingTime || 0) - (a.readingTime || 0);
      }
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [bookmarks, activeGroup, currentTab, debouncedSearchQuery, sortOption]);

  // Scroll Parent Ref for Viewport Virtualization
  const parentRef = useRef<HTMLDivElement>(null);

  // Responsive Grid Column Detection (Mobile: 2, Tablet/Laptop: 3, Desktop: 4)
  const getColumnCount = () => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w < 768) return 2;
    if (w < 1280) return 3;
    return 4;
  };

  const [columnCount, setColumnCount] = useState<number>(getColumnCount);

  useEffect(() => {
    const handleResize = () => {
      const next = getColumnCount();
      setColumnCount((prev) => (prev !== next ? next : prev));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Viewport Virtualizers
  const listVirtualizer = useVirtualizer({
    count: filteredBookmarks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 4,
    scrollMargin: 160,
  });

  const rowCount = Math.ceil(filteredBookmarks.length / columnCount);

  const gridVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 4,
    scrollMargin: 160,
  });

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
    if (isRead && b.ticktickTaskId) {
      try {
        const update = await syncCompletedBookmarkToTickTick(b);
        if (update && update.ticktickSyncStatus) {
          await bookmarkRepository.update(b.id, { ticktickSyncStatus: update.ticktickSyncStatus });
        }
      } catch (err) {
        console.warn('Failed to sync TickTick completion:', err);
      }
    }
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

  const onBulkDelete = useCallback(async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (window.confirm(`Delete ${count} selected bookmarks?`)) {
      await handleBulkDelete(() => {
        showToast("Deleted", `Deleted ${count} bookmarks`, "success");
      });
    }
  }, [selectedIds.size, handleBulkDelete, showToast]);

  const onBulkArchive = useCallback(async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    await handleBulkArchive(() => {
      showToast("Archived", `Archived ${count} bookmarks`, "success");
    });
  }, [selectedIds.size, handleBulkArchive, showToast]);

  const onBulkToggleRead = useCallback(async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    const selectedList = filteredBookmarks.filter((b) => selectedIds.has(b.id));
    const allRead = selectedList.length > 0 && selectedList.every((b) => b.isRead);
    const newStatus = !allRead;
    await handleBulkToggleRead(filteredBookmarks, () => {
      showToast("Updated", `Marked ${count} bookmarks as ${newStatus ? 'read' : 'unread'}`, "success");
    });
  }, [selectedIds, filteredBookmarks, handleBulkToggleRead, showToast]);

  const onBulkMoveGroup = useCallback(
    async (targetGroup: string) => {
      const count = selectedIds.size;
      if (count === 0) return;
      await handleBulkMoveGroup(targetGroup, () => {
        showToast("Moved", `Moved ${count} bookmark${count === 1 ? '' : 's'} to "${targetGroup}"`, "success");
      });
    },
    [selectedIds.size, handleBulkMoveGroup, showToast]
  );

  const hasOpenModal = Boolean(
    isCommandPaletteOpen ||
    readingBookmark ||
    deletingBookmark ||
    archivingBookmark ||
    groupModalState.isOpen ||
    editingBookmark ||
    isAddModalOpen ||
    isSidebarOpen
  );

  // Global Keyboard Shortcuts
  useBookmarkKeyboardShortcuts({
    searchInputRef,
    onOpenAddModal: () => setIsAddModalOpen(true),
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    isSelectionMode,
    onClearSelection: handleClearSelection,
    onBulkArchive: onBulkArchive,
    hasOpenModal,
  });

  const handleDismissReminder = async (b: LocalBookmark) => {
    await bookmarkRepository.update(b.id, { remindAt: "" });
    syncManager.sync(true);
    showToast("Reminder Dismissed", `Cleared reminder for "${b.title}"`, "info");
  };

  const handleSnoozeReminder = async (b: LocalBookmark) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newRemindAt = tomorrow.toISOString();
    await bookmarkRepository.update(b.id, { remindAt: newRemindAt });
    syncManager.sync(true);
    showToast("Reminder Snoozed", `Snoozed 1 day for "${b.title}"`, "info");
  };

  const handleAdvanceSeries = useCallback(async (b: LocalBookmark) => {
    const series = parseSeriesProgression(b.url, b.title);
    if (!series || !series.nextEpisodeUrl) {
      showToast("Next Episode", "No next episode URL could be automatically determined", "info");
      return;
    }
    await bookmarkRepository.advanceSeriesBookmark(b.id, series.nextEpisodeUrl, "advance");
    syncManager.sync(true);
    showToast("Series Advanced", `Progressed to ${formatEpisodicBadge({ episode: series.episode + 1, season: series.season })}`, "success");
  }, [showToast]);

  const handleRollbackSeries = useCallback(async (b: LocalBookmark) => {
    if (!b.seriesHistory || b.seriesHistory.length === 0) return;
    await bookmarkRepository.rollbackSeriesBookmark(b.id);
    syncManager.sync(true);
    showToast("Series Rolled Back", "Restored previous episode", "info");
  }, [showToast]);

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
      const groupBookmarkIds = groupBookmarks.map((b) => b.id);
      if (groupBookmarkIds.length > 0) {
        await bookmarkRepository.bulkUpdate(groupBookmarkIds, { group: "Unsorted" });
      }
      if (activeGroup === name) {
        handleGroupChange(null);
      }
      syncManager.sync(true);
    }
  };

  const handleAutoOrganize = async () => {
    const count = await autoOrganizeUnsortedBookmarks(user?.id || "local-user");
    syncManager.sync(true);
    showToast(
      count > 0 ? "Smart Auto-Group" : "Vault Organized",
      count > 0
        ? `Organized ${count} bookmark${count === 1 ? "" : "s"} into smart groups (YT, Insta, X)`
        : `All links in your vault are already categorized!`,
      count > 0 ? "success" : "info"
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-default)] font-sans">
      {/* Sidebar Navigation */}
      <GroupSidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeGroup={activeGroup}
        setActiveGroup={handleGroupChange}
        bookmarks={bookmarks}
        dbGroups={dbGroups}
        logout={logout}
        openEditGroup={handleOpenEditGroup}
        deleteGroup={handleDeleteGroup}
        openNewGroup={handleOpenNewGroup}
        onAutoOrganize={handleAutoOrganize}
        pinnedCategoryNames={pinnedCategoryNames}
        onTogglePin={handleToggleCategoryPin}
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
                href="/login?redirect=/app"
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
        <header className="flex-none min-h-[4rem] pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] active:scale-95 rounded-lg transition-all"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 md:hidden hover:opacity-85 transition-opacity cursor-pointer text-left select-none"
              title="About Markbel"
            >
              <MarkbelLogo size={24} className="shadow-xs" />
              <h1 className="text-base font-bold tracking-tight text-[var(--color-text-primary)] select-none">
                Markbel
              </h1>
            </button>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate hidden md:block">
              {activeGroup === "__broken__"
                ? "Broken Links"
                : activeGroup === "__media_video__"
                ? "Videos & Playlists"
                : activeGroup === "__media_article__"
                ? "Articles & News"
                : activeGroup === "__media_code__"
                ? "Code & Repositories"
                : activeGroup === "__media_social__"
                ? "Social & Threads"
                : activeGroup
                ? activeGroup
                : "All Bookmarks"}
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
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-bold hidden sm:flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bookmark</span>
            </button>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 lg:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-[1600px] mx-auto">
            {/* Filter Bar & Search */}
            <BookmarkFilterBar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              counts={counts}
              searchInputRef={searchInputRef}
              sortOption={sortOption}
              onSortChange={setSortOption}
              categoryPillBar={
                navPrefs.showMobileCategoryScroller ? (
                  <CategoryPillBar
                    groups={mergedGroups}
                    activeGroup={activeGroup}
                    onSelectGroup={handleGroupChange}
                    pinnedCategoryNames={pinnedCategoryNames}
                    onTogglePin={handleToggleCategoryPin}
                    totalCount={bookmarks.length}
                    onOpenNewGroup={handleOpenNewGroup}
                    compact
                  />
                ) : undefined
              }
            />

            {/* Tablet Category Pill Bar (Hidden on mobile < 640px where it is unified inside filter bar, and hidden on md: desktop) */}
            {navPrefs.showMobileCategoryScroller && (
              <div className="hidden sm:block md:hidden">
                <CategoryPillBar
                  groups={mergedGroups}
                  activeGroup={activeGroup}
                  onSelectGroup={handleGroupChange}
                  pinnedCategoryNames={pinnedCategoryNames}
                  onTogglePin={handleToggleCategoryPin}
                  totalCount={bookmarks.length}
                  onOpenNewGroup={handleOpenNewGroup}
                />
              </div>
            )}

            {/* Multiselect Action Bar */}
            <BookmarkBatchBar
              selectedCount={selectedIds.size}
              onClear={handleClearSelection}
              onToggleRead={onBulkToggleRead}
              onArchive={onBulkArchive}
              onDelete={onBulkDelete}
              groups={groupNames}
              onMoveGroup={onBulkMoveGroup}
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
                    : activeGroup === "__broken__"
                    ? "No broken links detected! Your links are healthy."
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
              <div
                style={{
                  height: `${listVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {listVirtualizer.getVirtualItems().map((virtualRow) => {
                  const b = filteredBookmarks[virtualRow.index];
                  if (!b) return null;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={listVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start - listVirtualizer.options.scrollMargin}px)`,
                      }}
                      className="pb-2 sm:pb-2.5"
                    >
                      <BookmarkCard
                        bookmark={b}
                        viewMode="list"
                        onClick={handleCardClick}
                        onTogglePin={handleTogglePin}
                        onToggleRead={handleToggleRead}
                        onArchive={(bookmark) => setArchivingBookmark(bookmark)}
                        onEdit={(bookmark) => setEditingBookmark(bookmark)}
                        onDelete={(bookmark) => setDeletingBookmark(bookmark)}
                        onOpenReader={(bookmark) => setReadingBookmark(bookmark)}
                        isSelected={selectedIds.has(b.id)}
                        selectionMode={isSelectionMode}
                        onToggleSelect={handleToggleSelect}
                        onDismissReminder={handleDismissReminder}
                        onSnoozeReminder={handleSnoozeReminder}
                        onAdvanceSeries={handleAdvanceSeries}
                        onRollbackSeries={handleRollbackSeries}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  height: `${gridVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                  const startIndex = virtualRow.index * columnCount;
                  const rowBookmarks = filteredBookmarks.slice(startIndex, startIndex + columnCount);

                  return (
                    <div
                      key={`${virtualRow.key}-${columnCount}`}
                      data-index={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start - gridVirtualizer.options.scrollMargin}px)`,
                      }}
                      className="pb-2.5 sm:pb-4 lg:pb-5"
                    >
                      <div
                        className="grid gap-2.5 sm:gap-4 lg:gap-5"
                        style={{
                          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                        }}
                      >
                        {rowBookmarks.map((b) => (
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
                            onOpenReader={(bookmark) => setReadingBookmark(bookmark)}
                            isSelected={selectedIds.has(b.id)}
                            selectionMode={isSelectionMode}
                            onToggleSelect={handleToggleSelect}
                            onDismissReminder={handleDismissReminder}
                            onSnoozeReminder={handleSnoozeReminder}
                            onAdvanceSeries={handleAdvanceSeries}
                            onRollbackSeries={handleRollbackSeries}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button (Mobile FAB) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-6 z-40 bg-[var(--color-accent)] text-white p-3.5 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center active:scale-95 transition-all"
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

      <ReaderModal
        isOpen={Boolean(readingBookmark)}
        bookmark={readingBookmark}
        onClose={() => setReadingBookmark(null)}
        onToggleRead={handleToggleRead}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        bookmarks={bookmarks}
        groups={groupNames}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onTriggerSync={() => {
          syncManager.sync(true);
          showToast("Sync Triggered", "Synchronizing library with Cloudflare Edge...", "info");
        }}
        onSelectGroup={(g) => {
          if (g === '__unread__') {
            setCurrentTab('unread');
          } else if (g === '__pinned__') {
            setCurrentTab('pinned');
          } else if (g === '__archived__') {
            navigate('/archive');
          } else {
            handleGroupChange(g);
          }
        }}
        onNavigateSettings={() => navigate('/settings')}
        onOpenBookmark={(b) => handleCardClick(b.url)}
        onOpenReader={(b) => setReadingBookmark(b)}
      />
    </div>
  );
}
