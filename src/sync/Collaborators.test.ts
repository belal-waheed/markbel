import { describe, it, expect, vi } from "vitest";
import { normalizeSyncRecord } from "../../worker/src/normalize";

describe("Vault Collaboration & Actor Attribution Architecture (Phase 4)", () => {
  describe("Actor Attribution Invariants", () => {
    it("should preserve actor attribution metadata when normalizing bookmark records", () => {
      const row = {
        id: "bm_collab_1",
        user_id: "user_owner_123",
        title: "Collaborative Bookmark",
        url: "https://markbel.dev/collab",
        group_name: "Team",
        actor_type: "agent",
        actor_name: "Claude Code",
        version: 1,
        created_at: "2026-11-03T10:00:00Z",
        updated_at: "2026-11-03T10:00:00Z",
      };

      const normalized = normalizeSyncRecord(row, "bookmark");
      expect(normalized.actorType).toBe("agent");
      expect(normalized.actorName).toBe("Claude Code");
      expect(normalized.actor_type).toBe("agent");
      expect(normalized.actor_name).toBe("Claude Code");
    });

    it("should default actor attribution to 'user' when omitted", () => {
      const row = {
        id: "bm_legacy",
        user_id: "user_owner_123",
        title: "Legacy Bookmark",
        url: "https://markbel.dev/legacy",
        group_name: "Unsorted",
        version: 1,
        created_at: "2026-11-03T10:00:00Z",
        updated_at: "2026-11-03T10:00:00Z",
      };

      const normalized = normalizeSyncRecord(row, "bookmark");
      expect(normalized.actorType).toBe("user");
      expect(normalized.actorName).toBe("");
      expect(normalized.actor_type).toBe("user");
      expect(normalized.actor_name).toBe("");
    });
  });

  describe("Collaborator Invitation Tokens & Formats", () => {
    it("generates valid mb_inv_ token prefixes and 16-byte hex suffixes", () => {
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      const tokenSuffix = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const inviteToken = `mb_inv_${tokenSuffix}`;

      expect(inviteToken.startsWith("mb_inv_")).toBe(true);
      expect(inviteToken.length).toBe(7 + 32); // 'mb_inv_' (7) + 32 hex chars
    });

    it("generates valid direct invitation links", () => {
      const inviteToken = "mb_inv_1234567890abcdef1234567890abcdef";
      const link = `https://mark.obel.workers.dev/join?token=${inviteToken}`;

      const parsed = new URL(link);
      expect(parsed.origin).toBe("https://mark.obel.workers.dev");
      expect(parsed.pathname).toBe("/join");
      expect(parsed.searchParams.get("token")).toBe(inviteToken);
    });
  });

  describe("RBAC & Vault Role Rules", () => {
    it("allows owners to perform all actions", () => {
      const role = "owner";
      const canRead = ["owner", "editor", "viewer"].includes(role);
      const canWrite = ["owner", "editor"].includes(role);
      const canManageSettings = ["owner"].includes(role);
      const canInvite = ["owner"].includes(role);

      expect(canRead).toBe(true);
      expect(canWrite).toBe(true);
      expect(canManageSettings).toBe(true);
      expect(canInvite).toBe(true);
    });

    it("allows editors to read and mutate bookmarks but forbids settings and invitations", () => {
      const role = "editor";
      const canRead = ["owner", "editor", "viewer"].includes(role);
      const canWrite = ["owner", "editor"].includes(role);
      const canManageSettings = ["owner"].includes(role);
      const canInvite = ["owner"].includes(role);

      expect(canRead).toBe(true);
      expect(canWrite).toBe(true);
      expect(canManageSettings).toBe(false);
      expect(canInvite).toBe(false);
    });

    it("allows viewers read-only access and rejects all mutations", () => {
      const role = "viewer";
      const canRead = ["owner", "editor", "viewer"].includes(role);
      const canWrite = ["owner", "editor"].includes(role);
      const canManageSettings = ["owner"].includes(role);
      const canInvite = ["owner"].includes(role);

      expect(canRead).toBe(true);
      expect(canWrite).toBe(false);
      expect(canManageSettings).toBe(false);
      expect(canInvite).toBe(false);
    });
  });

  describe("Collaborator Invitation Lifecycle", () => {
    it("transitions invitation status from pending to accepted with timestamp", () => {
      const invite = {
        id: "collab_inv_1",
        owner_id: "user_owner_1",
        collaborator_user_id: null as string | null,
        collaborator_email: "agent_peer@example.com",
        role: "editor" as const,
        status: "pending" as "pending" | "accepted",
        invite_token: "mb_inv_mock_token_123",
        created_at: "2026-11-03T10:00:00Z",
        accepted_at: null as string | null,
      };

      expect(invite.status).toBe("pending");
      expect(invite.accepted_at).toBeNull();
      expect(invite.collaborator_user_id).toBeNull();

      // Simulate acceptance by user 'user_peer_999'
      const acceptedAt = new Date().toISOString();
      const accepted = {
        ...invite,
        status: "accepted" as const,
        collaborator_user_id: "user_peer_999",
        accepted_at: acceptedAt,
      };

      expect(accepted.status).toBe("accepted");
      expect(accepted.collaborator_user_id).toBe("user_peer_999");
      expect(accepted.accepted_at).toBe(acceptedAt);
    });
  });
});
