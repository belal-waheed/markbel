import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  STORAGE_KEY,
  getPinnedCategories,
  setPinnedCategories,
  togglePinnedCategory,
  resolveHomeCategories,
} from './homeCategories';

describe('Homepage Categories Unit Tests (AAA Pattern)', () => {
  let storageMap: Record<string, string> = {};
  let localStorageMock: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };

  beforeEach(() => {
    storageMap = {};
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

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getPinnedCategories', () => {
    it('returns empty array when localStorage has no entry', () => {
      // Arrange (clean storage)

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual([]);
    });

    it('returns array of pinned categories when valid JSON array is stored', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['YouTube', 'Dev', 'Design']);

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual(['YouTube', 'Dev', 'Design']);
    });

    it('sanitizes items: trims strings, filters empty items and non-strings', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['  YouTube  ', '', 123, null, 'Dev  ', '   ']);

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual(['YouTube', 'Dev']);
    });

    it('returns empty array when localStorage content is malformed JSON', () => {
      // Arrange
      storageMap[STORAGE_KEY] = '{malformed-json';

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array when stored JSON is not an array', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify({ category: 'Dev' });

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual([]);
    });

    it('handles localStorage getItem throwing an exception gracefully', () => {
      // Arrange
      localStorageMock.getItem = vi.fn(() => {
        throw new Error('Storage access denied');
      });

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array if window is undefined (SSR simulation)', () => {
      // Arrange
      vi.stubGlobal('window', undefined);

      // Act
      const result = getPinnedCategories();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('setPinnedCategories', () => {
    it('writes unique, trimmed strings to localStorage', () => {
      // Arrange
      const input = [' YouTube ', 'Dev', 'YouTube', '  Design  '];

      // Act
      setPinnedCategories(input);

      // Assert
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['YouTube', 'Dev', 'Design'])
      );
    });

    it('handles empty input array properly', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['OldGroup']);

      // Act
      setPinnedCategories([]);

      // Assert
      expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify([]));
    });

    it('ignores empty strings and whitespace-only strings', () => {
      // Arrange
      const input = ['   ', '', 'Work'];

      // Act
      setPinnedCategories(input);

      // Assert
      expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(['Work']));
    });

    it('handles localStorage setItem throwing an exception gracefully without crash', () => {
      // Arrange
      localStorageMock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Act & Assert (should not throw)
      expect(() => setPinnedCategories(['Dev'])).not.toThrow();
    });

    it('does not throw when window is undefined (SSR simulation)', () => {
      // Arrange
      vi.stubGlobal('window', undefined);

      // Act & Assert
      expect(() => setPinnedCategories(['Dev'])).not.toThrow();
    });
  });

  describe('togglePinnedCategory', () => {
    it('pins a category when not previously pinned', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['YouTube']);

      // Act
      const updated = togglePinnedCategory('Dev');

      // Assert
      expect(updated).toEqual(['YouTube', 'Dev']);
      expect(JSON.parse(storageMap[STORAGE_KEY])).toEqual(['YouTube', 'Dev']);
    });

    it('unpins a category when previously pinned', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['YouTube', 'Dev']);

      // Act
      const updated = togglePinnedCategory('YouTube');

      // Assert
      expect(updated).toEqual(['Dev']);
      expect(JSON.parse(storageMap[STORAGE_KEY])).toEqual(['Dev']);
    });

    it('ignores empty and whitespace-only category names', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['YouTube']);

      // Act
      const updated = togglePinnedCategory('   ');

      // Assert
      expect(updated).toEqual(['YouTube']);
      expect(JSON.parse(storageMap[STORAGE_KEY])).toEqual(['YouTube']);
    });
  });

  describe('resolveHomeCategories', () => {
    it('handles empty groups list gracefully', () => {
      // Arrange
      const groups: { name: string; count: number }[] = [];

      // Act
      const result = resolveHomeCategories(groups, 6, ['Dev']);

      // Assert
      expect(result.visible).toEqual([]);
      expect(result.overflow).toEqual([]);
      expect(result.pinnedNames.has('Dev')).toBe(true);
    });

    it('sorts unpinned groups descending by bookmark count', () => {
      // Arrange
      const groups = [
        { name: 'Articles', count: 3 },
        { name: 'YouTube', count: 25 },
        { name: 'Dev', count: 12 },
        { name: 'Social', count: 1 },
      ];

      // Act
      const result = resolveHomeCategories(groups, 6, []);

      // Assert
      expect(result.visible.map((g) => g.name)).toEqual(['YouTube', 'Dev', 'Articles', 'Social']);
      expect(result.overflow).toEqual([]);
    });

    it('uses alphabetical tie-breaker when unpinned groups have equal counts', () => {
      // Arrange
      const groups = [
        { name: 'Zeta', count: 5 },
        { name: 'Alpha', count: 5 },
        { name: 'Beta', count: 5 },
      ];

      // Act
      const result = resolveHomeCategories(groups, 6, []);

      // Assert
      expect(result.visible.map((g) => g.name)).toEqual(['Alpha', 'Beta', 'Zeta']);
    });

    it('prioritizes pinned groups first regardless of bookmark count', () => {
      // Arrange
      const groups = [
        { name: 'YouTube', count: 100 },
        { name: 'Personal', count: 1 },
        { name: 'Dev', count: 50 },
        { name: 'Work', count: 0 },
      ];
      const pinned = ['Work', 'Personal'];

      // Act
      const result = resolveHomeCategories(groups, 6, pinned);

      // Assert: Work & Personal must be first (in order of user pinning), followed by YouTube, then Dev
      expect(result.visible.map((g) => g.name)).toEqual(['Work', 'Personal', 'YouTube', 'Dev']);
      expect(result.visible[0].isPinned).toBe(true);
      expect(result.visible[1].isPinned).toBe(true);
      expect(result.visible[2].isPinned).toBe(false);
      expect(result.visible[3].isPinned).toBe(false);
    });

    it('splits categories into visible and overflow according to maxVisible', () => {
      // Arrange
      const groups = [
        { name: 'G1', count: 10 },
        { name: 'G2', count: 9 },
        { name: 'G3', count: 8 },
        { name: 'G4', count: 7 },
        { name: 'G5', count: 6 },
        { name: 'G6', count: 5 },
        { name: 'G7', count: 4 },
        { name: 'G8', count: 3 },
      ];

      // Act (maxVisible = 4)
      const result = resolveHomeCategories(groups, 4, []);

      // Assert
      expect(result.visible).toHaveLength(4);
      expect(result.visible.map((g) => g.name)).toEqual(['G1', 'G2', 'G3', 'G4']);
      expect(result.overflow).toHaveLength(4);
      expect(result.overflow.map((g) => g.name)).toEqual(['G5', 'G6', 'G7', 'G8']);
    });

    it('defaults to reading pinned categories from localStorage if pinnedCategories is omitted', () => {
      // Arrange
      storageMap[STORAGE_KEY] = JSON.stringify(['Dev']);
      const groups = [
        { name: 'YouTube', count: 10 },
        { name: 'Dev', count: 2 },
      ];

      // Act
      const result = resolveHomeCategories(groups);

      // Assert
      expect(result.visible.map((g) => g.name)).toEqual(['Dev', 'YouTube']);
      expect(result.visible[0].isPinned).toBe(true);
      expect(result.visible[1].isPinned).toBe(false);
    });

    it('handles maxVisible = 0 cleanly', () => {
      // Arrange
      const groups = [{ name: 'YouTube', count: 5 }];

      // Act
      const result = resolveHomeCategories(groups, 0, []);

      // Assert
      expect(result.visible).toHaveLength(0);
      expect(result.overflow).toHaveLength(1);
    });
  });
});
