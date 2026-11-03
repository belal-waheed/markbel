import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncManager, SyncState } from "./SyncManager";
import {
  SyncStorage,
  ConnectivityProvider,
  LifecycleProvider,
  ApiClient,
  SyncOutboxItem,
  RemoteChange,
} from "./types";

describe("Network Degradation & Slow-Network Resilience Suite", () => {
  interface InMemStorage extends SyncStorage {
    outbox: Map<string, SyncOutboxItem>;
    cursor: number;
    appliedRemoteChanges: RemoteChange[];
  }

  const createInMemoryStorage = (initialItems: SyncOutboxItem[] = []): InMemStorage => {
    const outbox = new Map<string, SyncOutboxItem>();
    for (const item of initialItems) {
      outbox.set(item.id, { ...item });
    }

    let cursor = 0;
    const appliedRemoteChanges: RemoteChange[] = [];

    return {
      outbox,
      cursor,
      appliedRemoteChanges,

      getPendingChanges: vi.fn(async (limit: number) => {
        const pending: SyncOutboxItem[] = [];
        for (const item of outbox.values()) {
          if (item.status === "pending" || item.status === "failed") {
            pending.push({ ...item });
            if (pending.length >= limit) break;
          }
        }
        return pending;
      }),

      savePendingChange: vi.fn(async (change: SyncOutboxItem) => {
        outbox.set(change.id, { ...change });
      }),

      updatePendingChangeStatus: vi.fn(async (id: string, updates: Partial<SyncOutboxItem>) => {
        const existing = outbox.get(id);
        if (existing) {
          outbox.set(id, { ...existing, ...updates });
        }
      }),

      removePendingChanges: vi.fn(async (ids: string[]) => {
        for (const id of ids) {
          outbox.delete(id);
        }
      }),

      getProcessingChanges: vi.fn(async (limit = 1000) => {
        const processing: SyncOutboxItem[] = [];
        for (const item of outbox.values()) {
          if (item.status === "processing") {
            processing.push({ ...item });
            if (processing.length >= limit) break;
          }
        }
        return processing;
      }),

      recoverStaleProcessingChanges: vi.fn(async () => {
        let count = 0;
        for (const item of outbox.values()) {
          if (item.status === "processing") {
            item.status = "pending";
            item.lastError = "Recovered from stale processing state";
            count++;
          }
        }
        return count;
      }),

      getCursor: vi.fn(async () => cursor),
      saveCursor: vi.fn(async (c: number) => {
        cursor = c;
      }),

      getDeviceId: vi.fn(async () => "test-device-uuid"),
      saveDeviceId: vi.fn(async () => {}),
      getAuthToken: vi.fn(async () => "test-auth-token"),
      removeAuthToken: vi.fn(async () => {}),

      applyRemoteChanges: vi.fn(async (changes: RemoteChange[]) => {
        appliedRemoteChanges.push(...changes);
      }),

      transaction: vi.fn(async (cb) => cb()),
    };
  };

  const createMockEnv = (): ConnectivityProvider & LifecycleProvider => ({
    isOnline: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockReturnValue(() => {}),
    isForeground: vi.fn().mockResolvedValue(true),
    subscribeForeground: vi.fn().mockReturnValue(() => {}),
    onAuthExpired: vi.fn(),
  });

  const generateOutboxItem = (id: string, entityId = `bm-${id}`): SyncOutboxItem => ({
    id,
    entityType: "bookmark",
    entityId,
    operation: "create",
    baseVersion: 0,
    payload: { title: `Bookmark ${id}`, url: `https://example.com/${id}` },
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  });

  it("handles high RTT latency (500ms - 2000ms) gracefully and tracks duration metrics", async () => {
    const storage = createInMemoryStorage([generateOutboxItem("item-rtt-1")]);
    const env = createMockEnv();

    const simulatedLatencyMs = 60; // Scaled for fast unit testing while verifying elapsed tracking

    const mockApiClient: ApiClient = {
      post: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
        return {
          results: [{ changeId: "item-rtt-1", status: "applied", entityId: "bm-item-rtt-1", version: 1 }],
        };
      }),
      get: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
        return { changes: [], nextCursor: 1, hasMore: false };
      }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    await manager.sync(true);

    expect(manager.currentState).toBe(SyncState.Idle);
    expect(manager.metrics.lastPushDurationMs).toBeGreaterThanOrEqual(simulatedLatencyMs - 15);
    expect(manager.metrics.lastPullDurationMs).toBeGreaterThanOrEqual(simulatedLatencyMs - 15);
    expect(storage.outbox.size).toBe(0);
  });

  it("rolls back in-flight pushBatch items from processing to failed upon AbortController cancellation", async () => {
    const initialItems = [
      generateOutboxItem("abort-1"),
      generateOutboxItem("abort-2"),
      generateOutboxItem("abort-3"),
    ];
    const storage = createInMemoryStorage(initialItems);
    const env = createMockEnv();

    let capturedSignal: AbortSignal | undefined;
    const mockApiClient: ApiClient = {
      post: vi.fn(async (_url, _body, _headers, signal) => {
        capturedSignal = signal;
        // Simulate in-flight slow upload getting aborted
        return new Promise((_resolve, reject) => {
          if (signal) {
            signal.addEventListener("abort", () => {
              const err = new DOMException("The user aborted a request.", "AbortError");
              reject(err);
            });
          }
        });
      }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // Start sync asynchronously
    const syncPromise = manager.sync(true);

    // Give microtask time to start apiClient.post and mark items as processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Abort the in-flight sync
    manager.stop();
    await syncPromise;

    // Verify all 3 items were rolled back to 'failed' and NOT left as 'processing'
    for (const item of initialItems) {
      const stored = storage.outbox.get(item.id);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe("failed");
      expect(stored?.lastError).toMatch(/abort/i);
    }

    // Verify self-healing recovery resets failed/processing items on subsequent startup
    await manager.recoverStaleProcessingChanges();
    const pendingChanges = await storage.getPendingChanges(10);
    expect(pendingChanges).toHaveLength(3);
  });

  it("drains outbox with >150 items in batched chunks of 100 under slow network", async () => {
    // Generate 150 items
    const items: SyncOutboxItem[] = [];
    for (let i = 1; i <= 150; i++) {
      items.push(generateOutboxItem(`batch-item-${i}`));
    }
    const storage = createInMemoryStorage(items);
    const env = createMockEnv();

    const pushedBatches: any[] = [];
    const mockApiClient: ApiClient = {
      post: vi.fn(async (_url, payload) => {
        pushedBatches.push(payload);
        const results = payload.changes.map((c: any) => ({
          changeId: c.changeId,
          status: "applied",
          entityId: c.entityId,
          version: 1,
        }));
        return { results };
      }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    await manager.sync(true);

    // Verify exactly 2 push batches were executed (first: 100, second: 50)
    expect(pushedBatches).toHaveLength(2);
    expect(pushedBatches[0].changes).toHaveLength(100);
    expect(pushedBatches[1].changes).toHaveLength(50);
    expect(mockApiClient.post).toHaveBeenCalledTimes(2);

    // All 150 items should be cleanly applied and removed from outbox
    expect(storage.outbox.size).toBe(0);
    expect(manager.currentState).toBe(SyncState.Idle);
  });

  it("recovers from HTTP 504 Gateway Timeout and HTTP 429 Rate Limit errors without losing data", async () => {
    const item1 = generateOutboxItem("item-http-err");
    const storage = createInMemoryStorage([item1]);
    const env = createMockEnv();

    let attempt = 0;
    const mockApiClient: ApiClient = {
      post: vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          const err: any = new Error("Gateway Timeout");
          err.status = 504;
          throw err;
        }
        if (attempt === 2) {
          const err: any = new Error("Too Many Requests");
          err.status = 429;
          throw err;
        }
        return {
          results: [{ changeId: item1.id, status: "applied", entityId: item1.entityId, version: 1 }],
        };
      }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // Attempt 1: 504 Gateway Timeout
    await manager.sync(true);
    expect(manager.currentState).toBe(SyncState.Error);
    expect(manager.metrics.lastError).toBe("Gateway Timeout");
    expect(storage.outbox.get(item1.id)?.status).toBe("failed");

    // Attempt 2: 429 Rate Limit
    await manager.sync(true);
    expect(manager.currentState).toBe(SyncState.Error);
    expect(manager.metrics.lastError).toBe("Too Many Requests");
    expect(storage.outbox.get(item1.id)?.status).toBe("failed");

    // Attempt 3: Server recovers
    await manager.sync(true);
    expect(manager.currentState).toBe(SyncState.Idle);
    expect(storage.outbox.size).toBe(0);
  });

  it("guarantees idempotent cursor pull replay when connection terminates after remote changes applied but before cursor saved", async () => {
    const storage = createInMemoryStorage([]);
    const env = createMockEnv();

    const remoteBookmarkChange: RemoteChange = {
      changeId: "rem-1",
      entityType: "bookmark",
      entityId: "bm-remote-99",
      operation: "create",
      version: 1,
      payload: { title: "Remote Bookmark", url: "https://example.com/remote" },
    };

    let pullAttempt = 0;
    const mockApiClient: ApiClient = {
      post: vi.fn().mockResolvedValue({ results: [] }),
      get: vi.fn(async () => {
        pullAttempt++;
        if (pullAttempt === 1) {
          // Return changes, but mock storage.saveCursor failing on first pull
          return { changes: [remoteBookmarkChange], nextCursor: 100, hasMore: false };
        }
        // Second pull after restart
        return { changes: [remoteBookmarkChange], nextCursor: 100, hasMore: false };
      }),
      put: vi.fn().mockResolvedValue({}),
    };

    // Inject saveCursor failure on first attempt to simulate connection dropping before cursor update
    let saveCursorShouldFail = true;
    const originalSaveCursor = storage.saveCursor;
    storage.saveCursor = vi.fn(async (c: number) => {
      if (saveCursorShouldFail) {
        saveCursorShouldFail = false;
        throw new Error("Connection dropped before cursor saved");
      }
      return originalSaveCursor(c);
    });

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // First pull fails on saveCursor
    await manager.sync(true);
    expect(manager.currentState).toBe(SyncState.Error);
    expect(await storage.getCursor()).toBe(0); // Cursor was not advanced
    expect(storage.appliedRemoteChanges).toHaveLength(1);

    // Second pull replays the same change idempotently
    await manager.sync(true);
    expect(manager.currentState).toBe(SyncState.Idle);
    expect(await storage.getCursor()).toBe(100); // Cursor now successfully updated
    // applyRemoteChanges was called twice without throwing or violating idempotency
    expect(storage.appliedRemoteChanges).toHaveLength(2);
  });

  it("processes concurrent local mutations queued while a slow push is currently in-flight", async () => {
    const initialItem = generateOutboxItem("initial-item");
    const storage = createInMemoryStorage([initialItem]);
    const env = createMockEnv();

    const mockApiClient: ApiClient = {
      post: vi.fn(async (_url, payload) => {
        // While first push is in flight, a new mutation is added to storage
        if (payload.changes.some((c: any) => c.changeId === "initial-item")) {
          const concurrentItem = generateOutboxItem("concurrent-item");
          await storage.savePendingChange(concurrentItem);
        }
        return {
          results: payload.changes.map((c: any) => ({
            changeId: c.changeId,
            status: "applied",
            entityId: c.entityId,
            version: 1,
          })),
        };
      }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // Run first sync
    await manager.sync(true);

    // Initial item was pushed in batch 1
    expect(storage.outbox.has("initial-item")).toBe(false);

    // The concurrent item was created during the push and remains safely in outbox
    expect(storage.outbox.has("concurrent-item")).toBe(true);

    // Subsequent sync smoothly picks up and flushes the concurrent item
    await manager.sync(true);
    expect(storage.outbox.size).toBe(0);
    expect(manager.currentState).toBe(SyncState.Idle);
  });
});
