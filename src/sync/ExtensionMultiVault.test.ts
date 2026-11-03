import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebEnvironment } from "@/db/adapters/WebEnvironment";
import { saveBookmark, listSharedVaults, SharedVault } from "../../extension/src/api";
import { bookmarkRepository } from "@/db/SyncRepository";
import { syncManager } from "@/db/SyncManager";

describe("Extension Multi-Vault Architecture & WebEnvironment Hardening (Phase 3)", () => {
  describe("WebEnvironment Leader Lock Abort Handling", () => {
    let windowEventListeners: Map<string, Function[]>;
    let fakeWindow: any;

    beforeEach(() => {
      windowEventListeners = new Map();
      fakeWindow = {
        addEventListener: vi.fn((event: string, handler: Function) => {
          const list = windowEventListeners.get(event) || [];
          list.push(handler);
          windowEventListeners.set(event, list);
        }),
        removeEventListener: vi.fn((event: string, handler: Function) => {
          const list = windowEventListeners.get(event) || [];
          windowEventListeners.set(
            event,
            list.filter((fn) => fn !== handler)
          );
        }),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(globalThis, "window", {
        value: fakeWindow,
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("falls back to running acquire directly if navigator.locks is unavailable", async () => {
      Object.defineProperty(navigator, "locks", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const env = new WebEnvironment();

      let acquireCalled = false;
      await env.acquireLeaderLock("test-lock", async (release) => {
        acquireCalled = true;
        release();
      });

      expect(acquireCalled).toBe(true);
      expect(fakeWindow.addEventListener).not.toHaveBeenCalled();
    });

    it("registers beforeunload and pagehide listeners and passes abort signal to navigator.locks.request", async () => {
      let capturedSignal: AbortSignal | null = null;
      let lockAcquired = false;

      Object.defineProperty(navigator, "locks", {
        value: {
          request: vi.fn(async (lockName: string, options: any, callback: any) => {
            capturedSignal = options.signal;
            return await callback();
          }),
        },
        configurable: true,
        writable: true,
      });

      const env = new WebEnvironment();
      await env.acquireLeaderLock("test-lock", async (release) => {
        lockAcquired = true;
        release();
      });

      expect(lockAcquired).toBe(true);
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(fakeWindow.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
      expect(fakeWindow.addEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
      expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
      expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    });

    it("gracefully catches AbortError when pagehide fires before lock is granted", async () => {
      Object.defineProperty(navigator, "locks", {
        value: {
          request: vi.fn((lockName: string, options: any, callback: any) => {
            return new Promise((_, reject) => {
              options.signal.addEventListener("abort", () => {
                const abortErr = new Error("The lock request was aborted");
                abortErr.name = "AbortError";
                reject(abortErr);
              });
            });
          }),
        },
        configurable: true,
        writable: true,
      });

      const env = new WebEnvironment();
      const lockPromise = env.acquireLeaderLock("contested-lock", async (release) => {
        release();
      });

      // Simulate tab unload / extension popup closing
      const pagehideHandlers = windowEventListeners.get("pagehide") || [];
      expect(pagehideHandlers.length).toBeGreaterThan(0);
      for (const handler of pagehideHandlers) {
        handler();
      }

      // Must resolve without unhandled rejection or throwing
      await expect(lockPromise).resolves.toBeUndefined();
      expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
      expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    });

    it("gracefully catches AbortError when beforeunload fires before lock is granted", async () => {
      Object.defineProperty(navigator, "locks", {
        value: {
          request: vi.fn((lockName: string, options: any, callback: any) => {
            return new Promise((_, reject) => {
              options.signal.addEventListener("abort", () => {
                const domEx = new DOMException("The request was aborted", "AbortError");
                reject(domEx);
              });
            });
          }),
        },
        configurable: true,
        writable: true,
      });

      const env = new WebEnvironment();
      const lockPromise = env.acquireLeaderLock("contested-lock", async (release) => {
        release();
      });

      const beforeunloadHandlers = windowEventListeners.get("beforeunload") || [];
      expect(beforeunloadHandlers.length).toBeGreaterThan(0);
      for (const handler of beforeunloadHandlers) {
        handler();
      }

      await expect(lockPromise).resolves.toBeUndefined();
    });

    it("releases lock callback immediately if pagehide fires while holding the lock", async () => {
      let resolveHoldingPromise: (() => void) | null = null;
      Object.defineProperty(navigator, "locks", {
        value: {
          request: vi.fn(async (lockName: string, options: any, callback: any) => {
            return await callback();
          }),
        },
        configurable: true,
        writable: true,
      });

      const env = new WebEnvironment();
      const lockPromise = env.acquireLeaderLock("active-lock", async (_release) => {
        return new Promise<void>((res) => {
          resolveHoldingPromise = res;
        });
      });

      // Fire pagehide while lock is held
      const pagehideHandlers = windowEventListeners.get("pagehide") || [];
      for (const handler of pagehideHandlers) {
        handler();
      }

      await expect(lockPromise).resolves.toBeUndefined();
      if (resolveHoldingPromise) {
        (resolveHoldingPromise as () => void)();
      }
    });

    it("rethrows non-AbortError exceptions from navigator.locks.request", async () => {
      Object.defineProperty(navigator, "locks", {
        value: {
          request: vi.fn(async () => {
            throw new Error("Disk storage full or permission denied");
          }),
        },
        configurable: true,
        writable: true,
      });

      const env = new WebEnvironment();
      await expect(
        env.acquireLeaderLock("error-lock", async (release) => {
          release();
        })
      ).rejects.toThrow("Disk storage full or permission denied");
    });
  });

  describe("Extension Multi-Vault Save & X-Vault-Owner Propagation", () => {
    let mockStorage: Record<string, any>;
    let originalChrome: any;
    let originalFetch: any;

    beforeEach(() => {
      mockStorage = {
        authToken: "mock_jwt_session_token",
        authUser: {
          id: "user_personal_123",
          email: "user@markbel.dev",
          name: "Belal",
        },
        apiUrl: "https://mark.obel.workers.dev/api",
      };

      originalChrome = (globalThis as any).chrome;
      originalFetch = (globalThis as any).fetch;

      (globalThis as any).chrome = {
        storage: {
          local: {
            get: vi.fn(async (keys: string | string[]) => {
              if (Array.isArray(keys)) {
                const res: Record<string, any> = {};
                for (const k of keys) {
                  res[k] = mockStorage[k];
                }
                return res;
              }
              if (typeof keys === "string") {
                return { [keys]: mockStorage[keys] };
              }
              return { ...mockStorage };
            }),
            set: vi.fn(async (items: Record<string, any>) => {
              Object.assign(mockStorage, items);
            }),
            remove: vi.fn(async (keys: string | string[]) => {
              const list = Array.isArray(keys) ? keys : [keys];
              for (const k of list) {
                delete mockStorage[k];
              }
            }),
          },
        },
        runtime: {
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        permissions: {
          contains: vi.fn().mockResolvedValue(true),
          request: vi.fn().mockResolvedValue(true),
        },
      };

      vi.spyOn(bookmarkRepository, "create").mockResolvedValue({
        id: "bm_test",
        userId: "user_personal_123",
        title: "Test Bookmark",
        url: "https://example.com",
        group: "Unsorted",
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      });

      vi.spyOn(syncManager, "sync").mockResolvedValue();
    });

    afterEach(() => {
      (globalThis as any).chrome = originalChrome;
      (globalThis as any).fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("listSharedVaults calls /agent/v1/collaborators/shared-vaults with authorization token", async () => {
      const mockSharedVaults: SharedVault[] = [
        {
          id: "collab_1",
          owner_id: "user_team_lead",
          owner_name: "Engineering Team",
          owner_email: "team@markbel.dev",
          role: "editor",
          created_at: "2026-11-03T10:00:00Z",
        },
        {
          id: "collab_2",
          owner_id: "user_read_only",
          owner_name: "Archive Vault",
          owner_email: "archive@markbel.dev",
          role: "viewer",
          created_at: "2026-11-03T11:00:00Z",
        },
      ];

      (globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ shared_vaults: mockSharedVaults }),
      });

      const vaults = await listSharedVaults();
      expect(vaults).toHaveLength(2);
      expect(vaults[0].role).toBe("editor");
      expect(vaults[1].role).toBe("viewer");

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        "https://mark.obel.workers.dev/api/agent/v1/collaborators/shared-vaults",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock_jwt_session_token",
          }),
        })
      );
    });

    it("saveBookmark to personal vault uses session user id and standard sync headers", async () => {
      const res = await saveBookmark({
        url: "https://vitest.dev",
        title: "Vitest Testing Framework",
        group: "Dev",
      });

      expect(res.success).toBe(true);
      expect(bookmarkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_personal_123",
          url: "https://vitest.dev",
          title: "Vitest Testing Framework",
          group: "Dev",
        })
      );

      // Verify actor_type is NOT set to 'collaborator' for personal vault
      const createArg = (bookmarkRepository.create as any).mock.calls[0][0];
      expect(createArg.actor_type).toBeUndefined();

      // Verify sync was triggered without X-Vault-Owner header
      expect(syncManager.sync).toHaveBeenCalledWith(true, { headers: {} });
    });

    it("saveBookmark to shared vault sets target owner id, actor_type collaborator, and propagates X-Vault-Owner header", async () => {
      const res = await saveBookmark({
        url: "https://cloudflare.com",
        title: "Cloudflare Workers",
        group: "Infra",
        targetVaultOwnerId: "user_team_lead",
      });

      expect(res.success).toBe(true);

      // Verify bookmark record is stored with targetVaultOwnerId and collaborator actor
      expect(bookmarkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_team_lead",
          url: "https://cloudflare.com",
          title: "Cloudflare Workers",
          group: "Infra",
          actor_type: "collaborator",
        })
      );

      // Verify activeVaultOwnerId was persisted to chrome.storage.local
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeVaultOwnerId: "user_team_lead",
      });
      expect(mockStorage.activeVaultOwnerId).toBe("user_team_lead");

      // Verify X-Vault-Owner header was passed to syncManager.sync
      expect(syncManager.sync).toHaveBeenCalledWith(true, {
        headers: {
          "X-Vault-Owner": "user_team_lead",
        },
      });
    });
  });
});
