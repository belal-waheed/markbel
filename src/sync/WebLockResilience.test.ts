import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncManager, SyncState } from "./SyncManager";
import {
  SyncStorage,
  ConnectivityProvider,
  LifecycleProvider,
  ApiClient,
  SyncOutboxItem,
} from "./types";

// In-memory BroadcastChannel simulation for multi-tab communication
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: any }) => void) | null = null;
  private static registry = new Map<string, Set<MockBroadcastChannel>>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.registry.has(name)) {
      MockBroadcastChannel.registry.set(name, new Set());
    }
    MockBroadcastChannel.registry.get(name)!.add(this);
  }

  postMessage(data: any) {
    const subscribers = MockBroadcastChannel.registry.get(this.name);
    if (!subscribers) return;
    for (const sub of subscribers) {
      if (sub !== this && sub.onmessage) {
        sub.onmessage({ data });
      }
    }
  }

  close() {
    MockBroadcastChannel.registry.get(this.name)?.delete(this);
  }

  static reset() {
    MockBroadcastChannel.registry.clear();
  }
}

describe("WebLock Resilience & Multi-Tab Synchronization Suite", () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const createMockStorage = (items: SyncOutboxItem[] = []): SyncStorage => {
    const outbox = new Map<string, SyncOutboxItem>();
    for (const item of items) {
      outbox.set(item.id, { ...item });
    }
    let cursor = 0;

    return {
      getPendingChanges: vi.fn(async (limit: number) => {
        return Array.from(outbox.values()).slice(0, limit);
      }),
      savePendingChange: vi.fn(async (change) => {
        outbox.set(change.id, { ...change });
      }),
      updatePendingChangeStatus: vi.fn(async (id, updates) => {
        const existing = outbox.get(id);
        if (existing) outbox.set(id, { ...existing, ...updates });
      }),
      removePendingChanges: vi.fn(async (ids) => {
        for (const id of ids) outbox.delete(id);
      }),
      getCursor: vi.fn(async () => cursor),
      saveCursor: vi.fn(async (c) => {
        cursor = c;
      }),
      getDeviceId: vi.fn(async () => "device-tab-test"),
      saveDeviceId: vi.fn(async () => {}),
      getAuthToken: vi.fn(async () => "mock-tab-token"),
      removeAuthToken: vi.fn(async () => {}),
      applyRemoteChanges: vi.fn(async () => {}),
      transaction: vi.fn(async (cb) => cb()),
    };
  };

  it("handles Web Lock contention when leader tab is busy in a slow sync and designates follower state", async () => {
    // Simulated lock coordinator
    let currentHolder: string | null = null;
    let lockReleaseCallbacks = new Map<string, () => void>();

    const createLockableEnv = (tabId: string): ConnectivityProvider & LifecycleProvider => ({
      isOnline: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockReturnValue(() => {}),
      isForeground: vi.fn().mockResolvedValue(true),
      subscribeForeground: vi.fn().mockReturnValue(() => {}),
      onAuthExpired: vi.fn(),

      acquireLeaderLock: vi.fn(async (lockName: string, acquire: (release: () => void) => Promise<void>) => {
        if (!currentHolder) {
          currentHolder = tabId;
          return new Promise<void>((resolve) => {
            const release = () => {
              if (currentHolder === tabId) {
                currentHolder = null;
              }
              resolve();
            };
            lockReleaseCallbacks.set(tabId, release);
            acquire(release);
          });
        }
        // Lock contention: another tab holds the lock; this promise does not resolve until released
        return new Promise<void>((resolve) => {
          lockReleaseCallbacks.set(tabId, () => {
            currentHolder = tabId;
            resolve();
          });
        });
      }),
    });

    const envTab1 = createLockableEnv("tab-1");
    const envTab2 = createLockableEnv("tab-2");

    const mockApiClient: ApiClient = {
      post: vi.fn().mockResolvedValue({ results: [] }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const tab1 = new SyncManager({
      storage: createMockStorage(),
      connectivity: envTab1,
      lifecycle: envTab1,
      apiClient: mockApiClient,
    });

    const tab2 = new SyncManager({
      storage: createMockStorage(),
      connectivity: envTab2,
      lifecycle: envTab2,
      apiClient: mockApiClient,
    });

    // Start periodic sync on tab 1 -> acquires lock and becomes leader
    await tab1.startPeriodicSync();
    expect(tab1.leaderStatus).toBe(true);

    // Start periodic sync on tab 2 -> encounters contention
    await tab2.startPeriodicSync();

    // Tab 2 after 100ms timeout transitions to Follower state
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(tab2.leaderStatus).toBe(false);
    expect(tab2.currentState).toBe(SyncState.Follower);

    // Stop tab 1 -> releases lock
    tab1.stop();
    expect(tab1.leaderStatus).toBe(false);

    tab2.stop();
  });

  it("queues follower sync requests via BroadcastChannel during an active slow leader sync and executes them", async () => {
    let slowSyncResolve: (() => void) | null = null;
    let pushCount = 0;

    const mockApiClient: ApiClient = {
      post: vi.fn(async () => {
        pushCount++;
        if (pushCount === 1) {
          // Simulate slow in-flight sync in progress
          await new Promise<void>((resolve) => {
            slowSyncResolve = resolve;
          });
        }
        return { results: [] };
      }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const createDirectEnv = (isLead: boolean): ConnectivityProvider & LifecycleProvider => ({
      isOnline: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockReturnValue(() => {}),
      isForeground: vi.fn().mockResolvedValue(true),
      subscribeForeground: vi.fn().mockReturnValue(() => {}),
      onAuthExpired: vi.fn(),
      acquireLeaderLock: isLead
        ? vi.fn(async (_lock, acquire) => {
            await acquire(() => {});
          })
        : undefined, // Follower does not get leader lock API
    });

    const leaderStorage = createMockStorage([
      {
        id: "item-leader-1",
        entityType: "bookmark",
        entityId: "bm-1",
        operation: "create",
        baseVersion: 0,
        payload: { title: "Bm 1" },
        status: "pending",
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
    ]);

    const leader = new SyncManager({
      storage: leaderStorage,
      connectivity: createDirectEnv(true),
      lifecycle: createDirectEnv(true),
      apiClient: mockApiClient,
    });

    const follower = new SyncManager({
      storage: createMockStorage(),
      connectivity: createDirectEnv(false),
      lifecycle: createDirectEnv(false),
      apiClient: mockApiClient,
    });

    // Initialize leader -> acquires lock and triggers initial sync with item-leader-1
    await leader.startPeriodicSync();
    expect(leader.leaderStatus).toBe(true);

    // Yield to let push start and enter waiting in-flight state
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(leader.currentState).toBe(SyncState.Syncing);

    // Follower tab attempts to sync while leader is busy
    await follower.sync(false);

    // Verify leader queued the follower's request
    expect(leader.queuedSyncStatus).toBe(true);

    // Add another item so queued sync has mutations to push
    await leaderStorage.savePendingChange({
      id: "item-leader-queued",
      entityType: "bookmark",
      entityId: "bm-queued",
      operation: "create",
      baseVersion: 0,
      payload: { title: "Queued item" },
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    // Unblock the slow in-flight push
    if (slowSyncResolve) (slowSyncResolve as () => void)();

    // Yield for initial push to finish and queued sync microtask to run
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Verify second push was executed for the queued request
    expect(mockApiClient.post).toHaveBeenCalledTimes(2);

    leader.stop();
    follower.stop();
  });

  it("prevents deadlocks through AbortController cancellation during lock teardown", async () => {
    let teardownAborted = false;

    const mockWebLockEnv: LifecycleProvider & ConnectivityProvider = {
      isOnline: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockReturnValue(() => {}),
      isForeground: vi.fn().mockResolvedValue(true),
      subscribeForeground: vi.fn().mockReturnValue(() => {}),
      onAuthExpired: vi.fn(),

      acquireLeaderLock: vi.fn(async (_lockName, acquire) => {
        const controller = new AbortController();
        controller.signal.addEventListener("abort", () => {
          teardownAborted = true;
        });

        return new Promise<void>((resolve) => {
          acquire(() => {
            controller.abort();
            resolve();
          });
        });
      }),
    };

    const mockApiClient: ApiClient = {
      post: vi.fn().mockResolvedValue({ results: [] }),
      get: vi.fn().mockResolvedValue({ changes: [], nextCursor: 1, hasMore: false }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage: createMockStorage(),
      connectivity: mockWebLockEnv,
      lifecycle: mockWebLockEnv,
      apiClient: mockApiClient,
    });

    await manager.startPeriodicSync();
    expect(manager.leaderStatus).toBe(true);

    // Stopping manager cleanly releases lock and aborts lock controller
    manager.stop();
    expect(manager.leaderStatus).toBe(false);
    expect(teardownAborted).toBe(true);
  });
});
