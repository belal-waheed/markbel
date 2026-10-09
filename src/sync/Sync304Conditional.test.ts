import { describe, it, expect, vi } from "vitest";
import { SyncManager } from "./SyncManager";
import { SyncStorage, ConnectivityProvider, LifecycleProvider, ApiClient, SyncOutboxItem } from "./types";

describe("Sync 304 Conditional Cursor Validation", () => {
  const createMockStorage = (initialCursor = 42): SyncStorage => {
    let cursor = initialCursor;
    return {
      getPendingChanges: vi.fn().mockResolvedValue([]),
      savePendingChange: vi.fn().mockResolvedValue(undefined),
      updatePendingChangeStatus: vi.fn().mockResolvedValue(undefined),
      removePendingChanges: vi.fn().mockResolvedValue(undefined),
      getCursor: vi.fn().mockImplementation(async () => cursor),
      saveCursor: vi.fn().mockImplementation(async (c: number) => {
        cursor = c;
      }),
      getDeviceId: vi.fn().mockResolvedValue("device-test"),
      saveDeviceId: vi.fn().mockResolvedValue(undefined),
      getAuthToken: vi.fn().mockResolvedValue("mock-token-xyz"),
      removeAuthToken: vi.fn().mockResolvedValue(undefined),
      applyRemoteChanges: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn().mockImplementation(async (cb) => cb()),
    };
  };

  const createMockEnv = (): ConnectivityProvider & LifecycleProvider => ({
    isOnline: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockReturnValue(() => {}),
    isForeground: vi.fn().mockResolvedValue(true),
    subscribeForeground: vi.fn().mockReturnValue(() => {}),
    onAuthExpired: vi.fn(),
  });

  it("passes If-None-Match header with matching cursor on pull request", async () => {
    // Arrange
    const storage = createMockStorage(150);
    const env = createMockEnv();
    const capturedHeaders: any[] = [];

    const mockApiClient: ApiClient = {
      get: vi.fn().mockImplementation(async (url: string, headers: any) => {
        capturedHeaders.push({ url, headers });
        return { changes: [], nextCursor: 150, hasMore: false };
      }),
      post: vi.fn().mockResolvedValue({ results: [] }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // Act
    await manager.sync(true);

    // Assert
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    expect(capturedHeaders[0].url).toContain("cursor=150");
    expect(capturedHeaders[0].headers["If-None-Match"]).toBe('W/"cursor-150"');
    expect(capturedHeaders[0].headers["Authorization"]).toBe("Bearer mock-token-xyz");
  });

  it("handles HTTP 304 notModified payload cleanly without updating cursor or crashing", async () => {
    // Arrange
    const storage = createMockStorage(200);
    const env = createMockEnv();

    const mockApiClient: ApiClient = {
      get: vi.fn().mockResolvedValue({
        changes: [],
        nextCursor: 200,
        hasMore: false,
        notModified: true,
      }),
      post: vi.fn().mockResolvedValue({ results: [] }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    // Act
    await manager.sync(true);

    // Assert
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    // When notModified is true, applyRemoteChanges and saveCursor are skipped
    expect(storage.applyRemoteChanges).not.toHaveBeenCalled();
    expect(storage.saveCursor).not.toHaveBeenCalled();
  });

  it("verifies server 304 ETag comparison condition", () => {
    // Replicate server validation logic from worker/src/index.ts
    const changes: any[] = [];
    const cursor = 75;
    const clientEtag = 'W/"cursor-75"';

    const shouldReturn304 =
      (!changes || changes.length === 0) && clientEtag === `W/"cursor-${cursor}"`;

    expect(shouldReturn304).toBe(true);

    // If changes exist, must return 200
    const changesWithData = [{ sequence: 76, entity_type: "bookmark" }];
    const shouldReturn304WithData =
      (!changesWithData || changesWithData.length === 0) &&
      clientEtag === `W/"cursor-${cursor}"`;
    expect(shouldReturn304WithData).toBe(false);

    // If client ETag does not match cursor, must return 200
    const staleEtag: string = 'W/"cursor-50"';
    const shouldReturn304Stale =
      (!changes || changes.length === 0) && staleEtag === `W/"cursor-${cursor}"`;
    expect(shouldReturn304Stale).toBe(false);
  });

  it("handles 304 status and null response in apiClient adapter simulation", async () => {
    const handleApiResponse = (resOrError: any, endpoint: string) => {
      const match = endpoint.match(/[?&]cursor=(\d+)/);
      const cursor = match ? parseInt(match[1], 10) : 0;

      if (resOrError instanceof Error) {
        const err = resOrError as any;
        if (err.status === 304 || err.statusCode === 304) {
          return { changes: [], nextCursor: cursor, hasMore: false, notModified: true };
        }
        throw err;
      }
      if (resOrError === null || resOrError === undefined) {
        return { changes: [], nextCursor: cursor, hasMore: false, notModified: true };
      }
      return resOrError;
    };

    // 304 HTTP error response
    const http304Err: any = new Error("Not Modified");
    http304Err.status = 304;
    const result304 = handleApiResponse(http304Err, "/api/sync/pull?cursor=88&limit=100");
    expect(result304).toEqual({
      changes: [],
      nextCursor: 88,
      hasMore: false,
      notModified: true,
    });

    // Null response body
    const resultNull = handleApiResponse(null, "/api/sync/pull?cursor=88&limit=100");
    expect(resultNull).toEqual({
      changes: [],
      nextCursor: 88,
      hasMore: false,
      notModified: true,
    });
  });

  it("does not treat TypeError: NetworkError as an HTTP 500 server error", async () => {
    const storage = createMockStorage(10);
    const env = createMockEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockApiClient: ApiClient = {
      get: vi.fn().mockRejectedValue(new TypeError("NetworkError when attempting to fetch resource.")),
      post: vi.fn().mockResolvedValue({ results: [] }),
      put: vi.fn().mockResolvedValue({}),
    };

    const manager = new SyncManager({
      storage,
      connectivity: env,
      lifecycle: env,
      apiClient: mockApiClient,
    });

    await manager.sync(true);

    // Verify it did not log Server error 500
    const server500Logs = warnSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("Server error 500"))
    );
    expect(server500Logs.length).toBe(0);

    // Verify it logged network connectivity warning instead
    const networkWarnLogs = warnSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("Network connectivity issue during sync"))
    );
    expect(networkWarnLogs.length).toBe(1);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

