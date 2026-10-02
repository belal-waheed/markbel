import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEY,
  DEFAULT_NAVIGATION_PREFERENCES,
  getNavigationPreferences,
  setNavigationPreferences,
  toggleGroupVisibility,
  toggleGroupPin,
  filterAndSortGroups,
  NavigationPreferences,
} from "./navigationPreferences";
import { STORAGE_KEY as LEGACY_STORAGE_KEY } from "./homeCategories";

describe("navigationPreferences", () => {
  let storageMap: Record<string, string> = {};
  let eventListeners: Record<string, Function[]> = {};
  let localStorageMock: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };

  beforeEach(() => {
    storageMap = {};
    eventListeners = {};
    localStorageMock = {
      getItem: vi.fn((key: string) => (key in storageMap ? storageMap[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        storageMap[key] = String(value);
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMap[key];
      }),
      clear: vi.fn(() => {
        storageMap = {};
      }),
    };

    vi.stubGlobal("window", {
      localStorage: localStorageMock,
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: Function) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter((h) => h !== handler);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const handlers = eventListeners[event.type] || [];
        handlers.forEach((h) => h(event));
        return true;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getNavigationPreferences", () => {
    it("returns default preferences when localStorage is empty", () => {
      // Arrange (clean storage)

      // Act
      const prefs = getNavigationPreferences();

      // Assert
      expect(prefs).toEqual(DEFAULT_NAVIGATION_PREFERENCES);
      expect(prefs.hideEmptyGroups).toBe(true);
      expect(prefs.showMobileCategoryScroller).toBe(true);
      expect(prefs.defaultView).toBe("all");
      expect(prefs.hiddenGroupNames).toEqual([]);
      expect(prefs.pinnedGroupNames).toEqual([]);
    });

    it("safely handles corrupted or malformed JSON in localStorage", () => {
      // Arrange
      storageMap[STORAGE_KEY] = "{not-valid-json}}";

      // Act
      const prefs = getNavigationPreferences();

      // Assert
      expect(prefs).toEqual(DEFAULT_NAVIGATION_PREFERENCES);
    });

    it("migrates legacy pinned categories if present and preferences not yet created", () => {
      // Arrange
      storageMap[LEGACY_STORAGE_KEY] = JSON.stringify(["YouTube", "Tech"]);

      // Act
      const prefs = getNavigationPreferences();

      // Assert
      expect(prefs.pinnedGroupNames).toEqual(["YouTube", "Tech"]);
      expect(prefs.hideEmptyGroups).toBe(true);
    });

    it("sanitizes invalid data types and preserves valid entries", () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify({
        defaultView: "group:Dev",
        hideEmptyGroups: false,
        showMobileCategoryScroller: false,
        hiddenGroupNames: ["Archive", 123, null, "  News  ", ""],
        pinnedGroupNames: ["Dev", null, "Dev"], // test deduplication
      });

      // Act
      const prefs = getNavigationPreferences();

      // Assert
      expect(prefs.defaultView).toBe("group:Dev");
      expect(prefs.hideEmptyGroups).toBe(false);
      expect(prefs.showMobileCategoryScroller).toBe(false);
      expect(prefs.hiddenGroupNames).toEqual(["Archive", "News"]);
      expect(prefs.pinnedGroupNames).toEqual(["Dev"]);
    });

    it("returns default preferences when window or localStorage is undefined (SSR safety)", () => {
      // Arrange
      vi.stubGlobal("window", undefined);

      // Act
      const prefs = getNavigationPreferences();

      // Assert
      expect(prefs).toEqual(DEFAULT_NAVIGATION_PREFERENCES);
    });
  });

  describe("setNavigationPreferences", () => {
    it("persists partial updates merged with current preferences", () => {
      // Arrange
      expect(getNavigationPreferences().hideEmptyGroups).toBe(true);

      // Act
      const updated = setNavigationPreferences({
        hideEmptyGroups: false,
        defaultView: "pinned",
      });

      // Assert
      expect(updated.hideEmptyGroups).toBe(false);
      expect(updated.defaultView).toBe("pinned");
      expect(updated.showMobileCategoryScroller).toBe(true);

      const retrieved = getNavigationPreferences();
      expect(retrieved.hideEmptyGroups).toBe(false);
      expect(retrieved.defaultView).toBe("pinned");
    });

    it("syncs pinnedGroupNames to legacy homeCategories storage", () => {
      // Arrange & Act
      setNavigationPreferences({
        pinnedGroupNames: ["Articles", "Videos"],
      });

      // Assert
      const legacyRaw = storageMap[LEGACY_STORAGE_KEY];
      expect(legacyRaw).toBeDefined();
      expect(JSON.parse(legacyRaw!)).toEqual(["Articles", "Videos"]);
    });

    it("dispatches markbel_nav_preferences_changed custom event on window", () => {
      // Arrange
      const eventHandler = vi.fn();
      window.addEventListener("markbel_nav_preferences_changed", eventHandler);

      // Act
      setNavigationPreferences({ defaultView: "due" });

      // Assert
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("toggleGroupVisibility", () => {
    it("adds group to hiddenGroupNames when not currently hidden", () => {
      // Arrange
      expect(getNavigationPreferences().hiddenGroupNames).toEqual([]);

      // Act
      const prefs = toggleGroupVisibility("Gaming");

      // Assert
      expect(prefs.hiddenGroupNames).toContain("Gaming");
      expect(getNavigationPreferences().hiddenGroupNames).toEqual(["Gaming"]);
    });

    it("removes group from hiddenGroupNames when already hidden", () => {
      // Arrange
      setNavigationPreferences({ hiddenGroupNames: ["Gaming", "Entertainment"] });

      // Act
      const prefs = toggleGroupVisibility("Gaming");

      // Assert
      expect(prefs.hiddenGroupNames).toEqual(["Entertainment"]);
      expect(getNavigationPreferences().hiddenGroupNames).toEqual(["Entertainment"]);
    });

    it("ignores whitespace-only group names", () => {
      // Arrange & Act
      const prefs = toggleGroupVisibility("   ");

      // Assert
      expect(prefs.hiddenGroupNames).toEqual([]);
    });
  });

  describe("toggleGroupPin", () => {
    it("pins group when not currently pinned", () => {
      // Arrange
      expect(getNavigationPreferences().pinnedGroupNames).toEqual([]);

      // Act
      const prefs = toggleGroupPin("Design");

      // Assert
      expect(prefs.pinnedGroupNames).toContain("Design");
      expect(getNavigationPreferences().pinnedGroupNames).toEqual(["Design"]);
    });

    it("unpins group when already pinned", () => {
      // Arrange
      setNavigationPreferences({ pinnedGroupNames: ["Design", "Work"] });

      // Act
      const prefs = toggleGroupPin("Design");

      // Assert
      expect(prefs.pinnedGroupNames).toEqual(["Work"]);
      expect(getNavigationPreferences().pinnedGroupNames).toEqual(["Work"]);
    });

    it("ignores whitespace-only group names", () => {
      // Arrange & Act
      const prefs = toggleGroupPin("   ");

      // Assert
      expect(prefs.pinnedGroupNames).toEqual([]);
    });
  });

  describe("filterAndSortGroups", () => {
    it("auto-hides 0-count empty groups when hideEmptyGroups is true", () => {
      // Arrange
      const groups = [
        { name: "Dev", count: 5 },
        { name: "EmptyInbox", count: 0 },
        { name: "Design", count: 2 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        hideEmptyGroups: true,
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.visibleGroups.map((g) => g.name)).toEqual(["Design", "Dev"]);
      expect(result.hiddenGroups.map((g) => g.name)).toEqual(["EmptyInbox"]);
      expect(result.hiddenGroups[0].isAutoHiddenEmpty).toBe(true);
      expect(result.hiddenGroups[0].isPinned).toBe(false);
    });

    it("keeps 0-count empty groups visible if hideEmptyGroups is false", () => {
      // Arrange
      const groups = [
        { name: "Dev", count: 5 },
        { name: "EmptyInbox", count: 0 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        hideEmptyGroups: false,
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.visibleGroups.map((g) => g.name)).toEqual(["Dev", "EmptyInbox"]);
      expect(result.hiddenGroups).toEqual([]);
    });

    it("pinned empty groups stay in visibleGroups even when hideEmptyGroups is true", () => {
      // Arrange
      const groups = [
        { name: "EmptyPinned", count: 0 },
        { name: "EmptyUnpinned", count: 0 },
        { name: "Active", count: 4 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        hideEmptyGroups: true,
        pinnedGroupNames: ["EmptyPinned"],
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.visibleGroups.map((g) => g.name)).toEqual(["EmptyPinned", "Active"]);
      expect(result.visibleGroups.find((g) => g.name === "EmptyPinned")?.isPinned).toBe(true);
      expect(result.hiddenGroups.map((g) => g.name)).toEqual(["EmptyUnpinned"]);
    });

    it("manually hidden groups go to hiddenGroups regardless of count", () => {
      // Arrange
      const groups = [
        { name: "PopulatedHidden", count: 42 },
        { name: "VisibleGroup", count: 10 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        hiddenGroupNames: ["PopulatedHidden"],
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.visibleGroups.map((g) => g.name)).toEqual(["VisibleGroup"]);
      expect(result.hiddenGroups.map((g) => g.name)).toEqual(["PopulatedHidden"]);
      expect(result.hiddenGroups[0].isAutoHiddenEmpty).toBe(false);
    });

    it("sorts visible groups: pinned items at the top (alphabetical), then unpinned (alphabetical)", () => {
      // Arrange
      const groups = [
        { name: "Zeta", count: 1 },
        { name: "Alpha", count: 2 },
        { name: "PinnedBeta", count: 3 },
        { name: "PinnedAlpha", count: 4 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        pinnedGroupNames: ["PinnedBeta", "PinnedAlpha"],
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.visibleGroups.map((g) => g.name)).toEqual([
        "PinnedAlpha",
        "PinnedBeta",
        "Alpha",
        "Zeta",
      ]);
    });

    it("sorts hidden groups alphabetically", () => {
      // Arrange
      const groups = [
        { name: "Zulu", count: 0 },
        { name: "Charlie", count: 0 },
        { name: "Bravo", count: 0 },
      ];
      const prefs: NavigationPreferences = {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        hideEmptyGroups: true,
      };

      // Act
      const result = filterAndSortGroups(groups, prefs);

      // Assert
      expect(result.hiddenGroups.map((g) => g.name)).toEqual(["Bravo", "Charlie", "Zulu"]);
    });

    it("handles null or undefined input gracefully", () => {
      // Arrange
      const prefs = DEFAULT_NAVIGATION_PREFERENCES;

      // Act
      const result = filterAndSortGroups(null as any, prefs);

      // Assert
      expect(result.visibleGroups).toEqual([]);
      expect(result.hiddenGroups).toEqual([]);
    });
  });
});
