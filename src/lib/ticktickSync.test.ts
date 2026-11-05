import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTickTickProjects,
  createTickTickTask,
  completeTickTickTask,
  updateTickTickTask,
  syncCompletedBookmarkToTickTick,
  syncBookmarkToTickTick,
  getStoredTickTickConfig,
  setStoredTickTickConfig,
  TICKTICK_API_BASE,
} from './ticktickSync';
import { LocalBookmark } from '../db/db';

describe('TickTick Two-Way Synchronization Engine', () => {
  const mockToken = 'mock_ticktick_oauth_token';
  let storageMap: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    storageMap = {};
    const localStorageMock = {
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
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { localStorage: localStorageMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Configuration Persistence', () => {
    it('persists and reads TickTick token, project id, and enabled status', () => {
      setStoredTickTickConfig({
        token: 'test_tok_123',
        projectId: 'proj_read_list',
        enabled: true,
      });

      const config = getStoredTickTickConfig();
      expect(config.token).toBe('test_tok_123');
      expect(config.projectId).toBe('proj_read_list');
      expect(config.enabled).toBe(true);
    });
  });

  describe('getTickTickProjects', () => {
    it('sends authenticated GET request to /project and returns projects', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Inbox' },
        { id: 'proj-2', name: 'Reading List' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as any);

      const projects = await getTickTickProjects(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(`${TICKTICK_API_BASE}/project`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });
      expect(projects).toHaveLength(2);
      expect(projects[1].name).toBe('Reading List');
    });

    it('throws helpful error when token is missing or server returns error', async () => {
      await expect(getTickTickProjects('')).rejects.toThrow('TickTick API token is required');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid OAuth Token',
      } as any);

      await expect(getTickTickProjects(mockToken)).rejects.toThrow('Failed to fetch TickTick projects (401)');
    });
  });

  describe('createTickTickTask', () => {
    it('creates task with bookmark title, url and description', async () => {
      const mockBookmark: LocalBookmark = {
        id: 'bm-1',
        userId: 'u1',
        title: 'Deep Learning Specialization',
        url: 'https://coursera.org/learn/deep-learning',
        description: 'Comprehensive Coursera course by Andrew Ng',
        group: 'AI',
        version: 1,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        deletedAt: null,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'task-tick-1',
          projectId: 'proj-ai',
          title: mockBookmark.title,
          status: 0,
        }),
      } as any);

      const task = await createTickTickTask(mockToken, mockBookmark, 'proj-ai');

      expect(global.fetch).toHaveBeenCalledWith(
        `${TICKTICK_API_BASE}/task`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          },
        })
      );
      expect(task.id).toBe('task-tick-1');
      expect(task.projectId).toBe('proj-ai');
    });
  });

  describe('completeTickTickTask', () => {
    it('calls complete endpoint and returns success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as any);

      const result = await completeTickTickTask(mockToken, 'task-tick-1', 'proj-1');

      expect(global.fetch).toHaveBeenCalledWith(
        `${TICKTICK_API_BASE}/project/proj-1/task/task-tick-1/complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('syncCompletedBookmarkToTickTick', () => {
    it('completes remote task when local bookmark is read', async () => {
      const bookmark: LocalBookmark = {
        id: 'bm-read-1',
        userId: 'u1',
        title: 'Read this later',
        url: 'https://example.com/read',
        group: 'General',
        isRead: true,
        ticktickTaskId: 'task-read-1',
        ticktickProjectId: 'proj-1',
        version: 1,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        deletedAt: null,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as any);

      const updates = await syncCompletedBookmarkToTickTick(bookmark, {
        token: mockToken,
      });

      expect(updates.ticktickSyncStatus).toBe('synced');
    });
  });
});
