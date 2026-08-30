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
});
