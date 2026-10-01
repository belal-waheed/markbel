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
});
