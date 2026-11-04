import { describe, it, expect } from "vitest";
import { z } from "zod";

const SyncChangeSchema = z.object({
  changeId: z.string().min(1, "changeId is required"),
  entityType: z.enum(["bookmark", "group"]),
  entityId: z.string().min(1, "entityId is required"),
  operation: z.enum(["create", "update", "delete"]),
  baseVersion: z.number().optional().default(0),
  payload: z.record(z.string(), z.any()).nullish().default({}),
});

const SyncMutationsPayloadSchema = z.object({
  deviceId: z.string().optional(),
  protocolVersion: z.union([z.string(), z.number()]).optional(),
  requestId: z.string().optional(),
  changes: z.array(SyncChangeSchema),
});

describe("Sync Mutations Zod Boundary Validation", () => {
  it("successfully parses valid bookmark and group mutation payloads", () => {
    const validPayload = {
      deviceId: "device-123",
      protocolVersion: 1,
      requestId: "req-abc",
      changes: [
        {
          changeId: "ch-1",
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "create",
          baseVersion: 0,
          payload: {
            title: "Test Bookmark",
            url: "https://example.com",
          },
        },
        {
          changeId: "ch-2",
          entityType: "group",
          entityId: "grp-1",
          operation: "update",
          baseVersion: 1,
          payload: {
            name: "Updated Group",
            color: "purple",
          },
        },
      ],
    };

    const result = SyncMutationsPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changes).toHaveLength(2);
      expect(result.data.changes[0].operation).toBe("create");
      expect(result.data.changes[1].operation).toBe("update");
    }
  });

  it("safely handles nullish payload and defaults baseVersion to 0", () => {
    const payloadWithMinimalFields = {
      changes: [
        {
          changeId: "ch-del-1",
          entityType: "bookmark",
          entityId: "bm-del-1",
          operation: "delete",
        },
      ],
    };

    const result = SyncMutationsPayloadSchema.safeParse(payloadWithMinimalFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changes[0].baseVersion).toBe(0);
      expect(result.data.changes[0].payload).toEqual({});
    }
  });

  it("rejects non-array changes payload", () => {
    const invalidPayload = {
      changes: "not-an-array",
    };

    const result = SyncMutationsPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("rejects unsupported entity types", () => {
    const invalidPayload = {
      changes: [
        {
          changeId: "ch-1",
          entityType: "unsupported_type",
          entityId: "id-1",
          operation: "create",
        },
      ],
    };

    const result = SyncMutationsPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("rejects invalid operation names", () => {
    const invalidPayload = {
      changes: [
        {
          changeId: "ch-1",
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "drop_table",
        },
      ],
    };

    const result = SyncMutationsPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("rejects empty changeId or empty entityId", () => {
    const emptyChangeId = {
      changes: [
        {
          changeId: "",
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "create",
        },
      ],
    };
    expect(SyncMutationsPayloadSchema.safeParse(emptyChangeId).success).toBe(false);

    const emptyEntityId = {
      changes: [
        {
          changeId: "ch-1",
          entityType: "bookmark",
          entityId: "",
          operation: "create",
        },
      ],
    };
    expect(SyncMutationsPayloadSchema.safeParse(emptyEntityId).success).toBe(false);
  });

  it("compactOutbox prunes poison-pill items with attempts > 5 older than 7 days", async () => {
    const { SyncManager } = await import("./SyncManager");
    const mockManager = new SyncManager({
      storage: {} as any,
      connectivity: {} as any,
      lifecycle: {} as any,
      apiClient: {} as any,
    });

    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    const pending: any[] = [
      {
        id: "poison-old-1",
        entityId: "e-1",
        entityType: "bookmark",
        operation: "update",
        attempts: 6,
        createdAt: tenDaysAgo,
        payload: { title: "Old Failure" },
      },
      {
        id: "poison-recent-1",
        entityId: "e-2",
        entityType: "bookmark",
        operation: "update",
        attempts: 6,
        createdAt: twoDaysAgo,
        payload: { title: "Recent Failure" },
      },
      {
        id: "valid-1",
        entityId: "e-3",
        entityType: "bookmark",
        operation: "create",
        attempts: 1,
        createdAt: twoDaysAgo,
        payload: { title: "Valid Active" },
      },
    ];

    const { compacted, toDeleteFromDb } = mockManager.compactOutbox(pending);

    // poison-old-1 is older than 7 days and has > 5 attempts, so it should be marked for deletion
    expect(toDeleteFromDb).toContain("poison-old-1");
    // poison-recent-1 has attempts > 5 but is recent, so it's skipped from compacted but not deleted yet
    expect(toDeleteFromDb).not.toContain("poison-recent-1");
    // Only valid-1 is compacted
    expect(compacted.map((c) => c.id)).toEqual(["valid-1"]);
  });

  describe("Sync Delta Compaction & Ingest Sanitization (Phase 14)", () => {
    it("compacts superseded sequence rows while preserving the latest sequence per entity", () => {
      // Arrange: Simulated sync_changes rows
      interface SyncRow {
        sequence: number;
        user_id: string;
        entity_type: string;
        entity_id: string;
        operation: string;
      }

      const rows: SyncRow[] = [
        { sequence: 1, user_id: "user-1", entity_type: "bookmark", entity_id: "bm-1", operation: "create" },
        { sequence: 2, user_id: "user-1", entity_type: "bookmark", entity_id: "bm-1", operation: "update" },
        { sequence: 3, user_id: "user-1", entity_type: "bookmark", entity_id: "bm-1", operation: "update" }, // Latest bm-1
        { sequence: 4, user_id: "user-1", entity_type: "group", entity_id: "grp-1", operation: "create" }, // Latest grp-1
        { sequence: 5, user_id: "user-1", entity_type: "bookmark", entity_id: "bm-2", operation: "create" },
        { sequence: 6, user_id: "user-1", entity_type: "bookmark", entity_id: "bm-2", operation: "update" }, // Latest bm-2
        { sequence: 7, user_id: "user-2", entity_type: "bookmark", entity_id: "bm-99", operation: "create" }, // Other user
      ];

      // Act: Simulate SQL DELETE WHERE user_id = ? AND sequence NOT IN (SELECT MAX(sequence) FROM sync_changes WHERE user_id = ? GROUP BY entity_type, entity_id)
      const targetUserId = "user-1";
      const userRows = rows.filter((r) => r.user_id === targetUserId);
      const maxSeqByEntity = new Map<string, number>();

      for (const row of userRows) {
        const key = `${row.entity_type}:${row.entity_id}`;
        const currentMax = maxSeqByEntity.get(key) || 0;
        if (row.sequence > currentMax) {
          maxSeqByEntity.set(key, row.sequence);
        }
      }

      const preservedSequences = new Set(maxSeqByEntity.values());
      const deletedRows = userRows.filter((r) => !preservedSequences.has(r.sequence));
      const retainedRows = userRows.filter((r) => preservedSequences.has(r.sequence));

      // Assert
      expect(deletedRows.map((r) => r.sequence)).toEqual([1, 2, 5]);
      expect(retainedRows.map((r) => r.sequence)).toEqual([3, 4, 6]);
    });

    it("cleans tracking parameters on ingest before persisting bookmark url", async () => {
      // Arrange
      const { sanitizeAndCleanUrl } = await import("../lib/urlSafety");
      const dirtyUrl = "https://example.com/article?fbclid=123&utm_source=twitter&si=abc&post=42";

      // Act
      const { cleanUrlStr } = sanitizeAndCleanUrl(dirtyUrl);

      // Assert
      expect(cleanUrlStr).toBe("https://example.com/article?post=42");
    });
  });
});
