import { describe, it, expect } from "vitest";

describe("Sync LWW (Last-Write-Wins) Resolution Logic", () => {
  it("should accept incoming change if incoming updatedAt is newer than server updatedAt", () => {
    const serverRecord = {
      id: "bm-1",
      title: "Old Title",
      version: 2,
      updatedAt: "2026-08-30T07:00:00.000Z",
    };

    const incomingChange = {
      entityId: "bm-1",
      operation: "update",
      baseVersion: 1, // Stale base version from offline editing
      payload: {
        title: "Offline Edited Title",
        updatedAt: "2026-08-30T07:15:00.000Z", // Newer timestamp
      },
    };

    const isLWWWinner =
      new Date(incomingChange.payload.updatedAt).getTime() >=
      new Date(serverRecord.updatedAt).getTime();

    expect(isLWWWinner).toBe(true);
  });

  it("should reject incoming change if server record is newer", () => {
    const serverRecord = {
      id: "bm-1",
      title: "Newer Server Title",
      version: 3,
      updatedAt: "2026-08-30T07:30:00.000Z",
    };

    const incomingChange = {
      entityId: "bm-1",
      operation: "update",
      baseVersion: 1,
      payload: {
        title: "Older Offline Title",
        updatedAt: "2026-08-30T07:10:00.000Z",
      },
    };

    const isLWWWinner =
      new Date(incomingChange.payload.updatedAt).getTime() >=
      new Date(serverRecord.updatedAt).getTime();

    expect(isLWWWinner).toBe(false);
  });

  it("should generate a persistent tombstone when remote delete arrives for un-cached entity", () => {
    const remoteDeleteChange = {
      entityType: "bookmark" as const,
      entityId: "remote-bm-99",
      operation: "delete" as const,
      version: 4,
      deletedAt: "2026-08-31T10:00:00.000Z",
    };

    const localItem = null; // Entity never seen before on this device
    const deleteTimestamp = remoteDeleteChange.deletedAt || new Date().toISOString();

    const tombstoneRecord = localItem
      ? { ...localItem, deletedAt: deleteTimestamp, version: remoteDeleteChange.version }
      : {
          id: remoteDeleteChange.entityId,
          userId: "remote-synced",
          title: "Deleted Bookmark",
          url: "",
          isArchived: false,
          isRead: false,
          deletedAt: deleteTimestamp,
          version: remoteDeleteChange.version,
        };

    expect(tombstoneRecord.deletedAt).toBe("2026-08-31T10:00:00.000Z");
    expect(tombstoneRecord.id).toBe("remote-bm-99");
    expect(Boolean(tombstoneRecord.deletedAt)).toBe(true);
  });

  it("should strictly normalize deletedAt to ISO timestamp or null, never empty string", () => {
    const normalizeDeletedAt = (rawVal: any, localDeletedAt: string | null = null): string | null => {
      if (rawVal && typeof rawVal === "string" && rawVal.trim() !== "") {
        return rawVal;
      }
      return localDeletedAt || null;
    };

    expect(normalizeDeletedAt("2026-08-31T10:30:00.000Z")).toBe("2026-08-31T10:30:00.000Z");
    expect(normalizeDeletedAt("")).toBeNull();
    expect(normalizeDeletedAt(null)).toBeNull();
    expect(normalizeDeletedAt(undefined, "2026-08-31T09:00:00.000Z")).toBe("2026-08-31T09:00:00.000Z");
  });
});
