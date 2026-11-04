import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeUrlHealth, handleScheduledLinkHealthCheck } from '../../worker/src/lib/linkHealth';

describe('Phase 17: Link Health & 404 Rot Detector Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags HTTP 404 Not Found as isBroken=true', async () => {
    // Arrange
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });

    // Act
    const result = await probeUrlHealth('https://example.com/dead-link');

    // Assert
    expect(result.isBroken).toBe(true);
    expect(result.httpStatus).toBe(404);
  });

  it('flags HTTP 410 Gone as isBroken=true', async () => {
    // Arrange
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 410,
      ok: false,
    });

    // Act
    const result = await probeUrlHealth('https://example.com/gone-resource');

    // Assert
    expect(result.isBroken).toBe(true);
    expect(result.httpStatus).toBe(410);
  });

  it('marks HTTP 200 OK as isBroken=false', async () => {
    // Arrange
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    });

    // Act
    const result = await probeUrlHealth('https://example.com/healthy-page');

    // Assert
    expect(result.isBroken).toBe(false);
    expect(result.httpStatus).toBe(200);
  });

  it('catches network/DNS timeouts and returns isBroken=true with status 0', async () => {
    // Arrange
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND broken-domain.com'));

    // Act
    const result = await probeUrlHealth('https://broken-domain.com');

    // Assert
    expect(result.isBroken).toBe(true);
    expect(result.httpStatus).toBe(0);
  });

  it('scheduled handler processes oldest uninspected bookmarks and writes sync_changes delta', async () => {
    // Arrange
    const mockPrepare = vi.fn();
    const mockBind = vi.fn();
    const mockAll = vi.fn();
    const mockRun = vi.fn();

    const mockBookmarks = [
      {
        id: 'bm-1',
        user_id: 'user-123',
        url: 'https://broken.com',
        title: 'Broken Link',
        is_broken: 0,
        http_status: null,
        last_checked_at: null,
        version: 1,
      },
      {
        id: 'bm-2',
        user_id: 'user-123',
        url: 'https://healthy.com',
        title: 'Healthy Link',
        is_broken: 0,
        http_status: null,
        last_checked_at: null,
        version: 3,
      },
    ];

    mockAll.mockResolvedValue({ results: mockBookmarks });
    mockRun.mockResolvedValue({ success: true });
    mockBind.mockReturnValue({
      all: mockAll,
      run: mockRun,
      first: vi.fn(),
    });
    mockPrepare.mockReturnValue({ bind: mockBind });

    const mockEnv = {
      DB: {
        prepare: mockPrepare,
      },
    } as any;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('broken')) {
        return Promise.resolve({ status: 404, ok: false });
      }
      return Promise.resolve({ status: 200, ok: true });
    });

    // Act
    const stats = await handleScheduledLinkHealthCheck(mockEnv, 10);

    // Assert
    expect(stats.checked).toBe(2);
    expect(stats.broken).toBe(1);
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('immediately blocks unsafe loopback, private CIDR, and metadata URLs from probing', async () => {
    // Arrange
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    // Act
    const loopback = await probeUrlHealth('http://127.0.0.1:8080/admin');
    const metadata = await probeUrlHealth('http://169.254.169.254/latest/meta-data');
    const privateIp = await probeUrlHealth('http://192.168.1.1/router');

    // Assert
    expect(loopback).toEqual({ isBroken: true, httpStatus: 400 });
    expect(metadata).toEqual({ isBroken: true, httpStatus: 400 });
    expect(privateIp).toEqual({ isBroken: true, httpStatus: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips version bump and sync_changes delta when health status is unchanged', async () => {
    // Arrange
    const mockPrepare = vi.fn();
    const mockBind = vi.fn();
    const mockAll = vi.fn();
    const mockRun = vi.fn();

    const mockBookmarks = [
      {
        id: 'bm-healthy-1',
        user_id: 'user-123',
        url: 'https://healthy.com',
        title: 'Healthy Link',
        is_broken: 0,
        http_status: 200,
        last_checked_at: '2026-10-01T00:00:00.000Z',
        version: 5,
      },
    ];

    mockAll.mockResolvedValue({ results: mockBookmarks });
    mockRun.mockResolvedValue({ success: true });
    mockBind.mockReturnValue({
      all: mockAll,
      run: mockRun,
      first: vi.fn(),
    });
    mockPrepare.mockReturnValue({ bind: mockBind });

    const mockEnv = {
      DB: {
        prepare: mockPrepare,
      },
    } as any;

    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });

    // Act
    const stats = await handleScheduledLinkHealthCheck(mockEnv, 10);

    // Assert
    expect(stats.checked).toBe(1);
    expect(stats.broken).toBe(0);
    // Should NOT prepare sync_changes insert statement
    const prepareCalls = mockPrepare.mock.calls.map((c) => c[0]);
    const insertedSyncChanges = prepareCalls.some((sql: string) => sql.includes('sync_changes'));
    expect(insertedSyncChanges).toBe(false);
    // Should only run UPDATE bookmarks SET last_checked_at = ?
    const updatedLastCheckedOnly = prepareCalls.some((sql: string) =>
      sql.includes('UPDATE bookmarks SET last_checked_at = ? WHERE id = ?')
    );
    expect(updatedLastCheckedOnly).toBe(true);
  });
});
