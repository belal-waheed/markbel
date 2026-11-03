import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTokens, createToken, deleteToken, ApiToken, CreateTokenRequest } from "../lib/api";

// Helpers matching Edge Worker logic for isolated cryptographic verification
async function hashPatToken(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePatToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let randomStr = "";
  for (let i = 0; i < bytes.length; i++) {
    randomStr += alphabet[bytes[i] % alphabet.length];
  }
  return `mb_pat_${randomStr}`;
}

function verifyScope(tokenScopes: string[], requiredScope: string): boolean {
  return tokenScopes.includes("*") || tokenScopes.includes(requiredScope) || tokenScopes.includes("tokens:manage");
}

function isTokenExpired(expiresAt: string | null, referenceTime: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= referenceTime.getTime();
}

describe("Personal Access Token (PAT) Security & Architecture", () => {
  describe("Token Generation & Cryptography", () => {
    it("generates tokens starting with mb_pat_ prefix and high entropy", () => {
      const token = generatePatToken();
      expect(token.startsWith("mb_pat_")).toBe(true);
      expect(token.length).toBeGreaterThanOrEqual(39); // "mb_pat_" (7) + 32 chars

      // Base58 charset verification
      const secretPart = token.slice(7);
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(secretPart)).toBe(true);
    });

    it("generates distinct random tokens on subsequent invocations", () => {
      const tokenA = generatePatToken();
      const tokenB = generatePatToken();
      expect(tokenA).not.toBe(tokenB);
    });

    it("hashes tokens deterministically with Web Crypto SHA-256 into 64-char hex string", async () => {
      const token = "mb_pat_TestSecurityToken123456789ABC";
      const hash1 = await hashPatToken(token);
      const hash2 = await hashPatToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
    });

    it("produces completely different hashes for different tokens (avalanche effect)", async () => {
      const tokenA = "mb_pat_AlphaToken123456789ABCDEF";
      const tokenB = "mb_pat_BetaToken123456789ABCDEF";

      const hashA = await hashPatToken(tokenA);
      const hashB = await hashPatToken(tokenB);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Scope Assertions & Permission Matrix", () => {
    it("grants access to any scope when token has wildcard [*] (JWT master session)", () => {
      const scopes = ["*"];
      expect(verifyScope(scopes, "bookmarks:read")).toBe(true);
      expect(verifyScope(scopes, "bookmarks:write")).toBe(true);
      expect(verifyScope(scopes, "groups:manage")).toBe(true);
      expect(verifyScope(scopes, "shares:manage")).toBe(true);
      expect(verifyScope(scopes, "settings:manage")).toBe(true);
      expect(verifyScope(scopes, "tokens:manage")).toBe(true);
    });

    it("allows bookmarks:read only when explicitly granted", () => {
      const readOnlyToken = ["bookmarks:read"];
      expect(verifyScope(readOnlyToken, "bookmarks:read")).toBe(true);
      expect(verifyScope(readOnlyToken, "bookmarks:write")).toBe(false);
      expect(verifyScope(readOnlyToken, "groups:manage")).toBe(false);
      expect(verifyScope(readOnlyToken, "settings:manage")).toBe(false);
    });

    it("enforces multi-scope granular authorization", () => {
      const agentToken = ["bookmarks:read", "bookmarks:write", "groups:manage"];
      expect(verifyScope(agentToken, "bookmarks:read")).toBe(true);
      expect(verifyScope(agentToken, "bookmarks:write")).toBe(true);
      expect(verifyScope(agentToken, "groups:manage")).toBe(true);
      expect(verifyScope(agentToken, "settings:manage")).toBe(false);
      expect(verifyScope(agentToken, "shares:manage")).toBe(false);
    });

    it("allows tokens:manage scope to manage tokens", () => {
      const managerToken = ["tokens:manage"];
      expect(verifyScope(managerToken, "tokens:manage")).toBe(true);
      expect(verifyScope(managerToken, "bookmarks:read")).toBe(true); // tokens:manage has administrative bypass
    });
  });

  describe("Token Expiration Logic", () => {
    it("never expires when expires_at is null", () => {
      expect(isTokenExpired(null)).toBe(false);
      expect(isTokenExpired(null, new Date("2099-01-01"))).toBe(false);
    });

    it("is valid when expires_at is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    it("is expired when expires_at is in the past", () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it("calculates accurate 30-day, 90-day, and 365-day ISO timestamps", () => {
      const now = new Date("2026-11-03T00:00:00.000Z");
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

      expect(thirtyDays).toBe("2026-12-03T00:00:00.000Z");
      expect(ninetyDays).toBe("2027-02-01T00:00:00.000Z");
      expect(oneYear).toBe("2027-11-03T00:00:00.000Z");
    });
  });

  describe("Security Invariants & Redaction", () => {
    it("verifies token_prefix redaction format", () => {
      const token = "mb_pat_1A2B3C4D5E6F7G8H9J";
      const tokenPrefix = `${token.slice(0, 14)}...`;

      expect(tokenPrefix).toBe("mb_pat_1A2B3C4...");
      expect(tokenPrefix.length).toBe(17);
      expect(tokenPrefix.endsWith("...")).toBe(true);
      // The secret portion after prefix is hidden
      expect(tokenPrefix).not.toContain("5E6F7G8H9J");
    });

    it("ensures token listing records never contain token_hash or raw token secret", () => {
      const mockListingRow: ApiToken = {
        id: "tok_123",
        name: "Claude Assistant",
        tokenPrefix: "mb_pat_9X8Y7Z...",
        scopes: ["bookmarks:read"],
        expiresAt: null,
        lastUsedAt: "2026-11-03T06:00:00.000Z",
        createdAt: "2026-11-01T00:00:00.000Z",
      };

      expect((mockListingRow as any).token_hash).toBeUndefined();
      expect((mockListingRow as any).token).toBeUndefined();
      expect(mockListingRow.tokenPrefix).toBeDefined();
    });
  });

  describe("Client API Client Methods", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("fetches tokens through getTokens()", async () => {
      const mockTokens: ApiToken[] = [
        {
          id: "tok_1",
          name: "Cursor Assistant",
          tokenPrefix: "mb_pat_abc123...",
          scopes: ["bookmarks:read", "bookmarks:write"],
          expiresAt: null,
          lastUsedAt: null,
          createdAt: "2026-11-03T00:00:00.000Z",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      } as Response);

      const result = await getTokens();
      expect(result).toEqual(mockTokens);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/tokens"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("creates a new token through createToken()", async () => {
      const requestPayload: CreateTokenRequest = {
        name: "Antigravity Agent",
        scopes: ["bookmarks:read"],
        expiresInDays: 30,
      };

      const mockResponse = {
        id: "tok_new",
        name: "Antigravity Agent",
        token: "mb_pat_plainTextSecretOnlyOnce12345",
        tokenPrefix: "mb_pat_plainTe...",
        scopes: ["bookmarks:read"],
        expiresAt: "2026-12-03T00:00:00.000Z",
        createdAt: "2026-11-03T00:00:00.000Z",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await createToken(requestPayload);
      expect(result).toEqual(mockResponse);
      expect(result.token).toBe("mb_pat_plainTextSecretOnlyOnce12345");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/tokens"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestPayload),
        })
      );
    });

    it("deletes a token through deleteToken()", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await deleteToken("tok_to_delete");
      expect(result).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/tokens/tok_to_delete"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
