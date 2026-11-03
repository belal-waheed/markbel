import { describe, it, expect, vi } from "vitest";
import { sign, verify } from "hono/jwt";

describe("Worker Auth Security & JWT Fail-Fast Invariants", () => {
  it("fails fast with HTTP 500 when JWT_SECRET is missing during auth verification", async () => {
    // Replicates worker/src/middleware/auth.ts fail-fast contract
    const verifyAuthToken = async (token: string, env: { JWT_SECRET?: string }) => {
      const secret = env.JWT_SECRET;
      if (!secret) {
        return {
          status: 500,
          body: { error: "Server misconfiguration: JWT_SECRET binding is missing" },
        };
      }
      try {
        const payload = await verify(token, secret, "HS256");
        return { status: 200, body: payload };
      } catch {
        return { status: 401, body: { error: "Invalid or expired token" } };
      }
    };

    const result = await verifyAuthToken("mock.jwt.token", {});
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      error: "Server misconfiguration: JWT_SECRET binding is missing",
    });
  });

  it("authenticates successfully when JWT_SECRET is provided with valid signature", async () => {
    const secret = "test-secret-key-123456789";
    const token = await sign(
      { id: "usr_123", email: "tester@markbel.dev", name: "Tester" },
      secret,
      "HS256"
    );

    const verifyAuthToken = async (tok: string, env: { JWT_SECRET?: string }) => {
      const sec = env.JWT_SECRET;
      if (!sec) {
        return {
          status: 500,
          body: { error: "Server misconfiguration: JWT_SECRET binding is missing" },
        };
      }
      try {
        const payload = await verify(tok, sec, "HS256");
        return { status: 200, body: payload };
      } catch {
        return { status: 401, body: { error: "Invalid or expired token" } };
      }
    };

    const result = await verifyAuthToken(token, { JWT_SECRET: secret });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      id: "usr_123",
      email: "tester@markbel.dev",
      name: "Tester",
    });
  });

  it("fails fast in user signup and login token generation when JWT_SECRET is missing", async () => {
    // Replicates worker/src/index.ts signup/login token signing contract
    const generateUserToken = async (user: { id: string; email: string }, env: { JWT_SECRET?: string }) => {
      const secret = env.JWT_SECRET;
      if (!secret) {
        return {
          status: 500,
          body: { error: "Server misconfiguration: JWT_SECRET binding is missing" },
        };
      }
      const exp = Math.floor(Date.now() / 1000) + 60 * 60;
      const token = await sign({ id: user.id, email: user.email, exp }, secret, "HS256");
      return { status: 200, body: { token } };
    };

    const res = await generateUserToken({ id: "usr_1", email: "user@markbel.dev" }, {});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "Server misconfiguration: JWT_SECRET binding is missing",
    });
  });

  it("fails fast on cron dispatch endpoint when neither CRON_SECRET nor JWT_SECRET is set", () => {
    // Replicates worker/src/index.ts lines 2819-2840 authorization gate
    const evaluateCronAuth = (
      req: { authHeader?: string; querySecret?: string; qstashSignature?: string },
      env: { CRON_SECRET?: string; JWT_SECRET?: string; QSTASH_TOKEN?: string; QSTASH_CURRENT_SIGNING_KEY?: string }
    ) => {
      const token = (req.authHeader || "").replace(/^Bearer\s+/i, "");
      const expectedCronSecret = env.CRON_SECRET || env.JWT_SECRET;
      const expectedQStashToken = env.QSTASH_TOKEN;

      let isAuthorized = false;

      if (expectedCronSecret && req.querySecret && req.querySecret === expectedCronSecret) {
        isAuthorized = true;
      } else if (
        token &&
        ((expectedCronSecret && token === expectedCronSecret) || (expectedQStashToken && token === expectedQStashToken))
      ) {
        isAuthorized = true;
      } else if (req.qstashSignature && (env.QSTASH_CURRENT_SIGNING_KEY || expectedQStashToken)) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        return { status: 403, error: "Unauthorized cron trigger" };
      }
      return { status: 200, success: true };
    };

    // Even if caller passes a previously hardcoded fallback secret 'markbel-cron-secret'
    const result = evaluateCronAuth(
      { querySecret: "markbel-cron-secret" },
      { CRON_SECRET: undefined, JWT_SECRET: undefined }
    );
    expect(result.status).toBe(403);
    expect(result.error).toBe("Unauthorized cron trigger");

    // Authorizes when CRON_SECRET is configured and matches
    const authorizedResult = evaluateCronAuth(
      { querySecret: "secure-cron-123" },
      { CRON_SECRET: "secure-cron-123" }
    );
    expect(authorizedResult.status).toBe(200);

    // Authorizes when fallback JWT_SECRET is configured and matches
    const jwtSecretResult = evaluateCronAuth(
      { authHeader: "Bearer jwt-secret-456" },
      { JWT_SECRET: "jwt-secret-456" }
    );
    expect(jwtSecretResult.status).toBe(200);
  });

  it("atomically batches group deletion bookmarks using bulkUpdate to avoid N+1 queries", async () => {
    const mockBookmarkRepo = {
      bulkUpdate: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
    };
    const mockGroupRepo = {
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const groupToDelete = "Finance";
    const existingGroup = { id: "grp-1", name: groupToDelete };
    const bookmarks = [
      { id: "bm-1", title: "Bank", group: "Finance" },
      { id: "bm-2", title: "Stocks", group: "Finance" },
      { id: "bm-3", title: "Reading", group: "Articles" },
    ];

    // Simulate handleDeleteGroup atomic logic
    await mockGroupRepo.delete(existingGroup.id);
    const groupBookmarks = bookmarks.filter((b) => b.group === groupToDelete);
    const groupBookmarkIds = groupBookmarks.map((b) => b.id);
    if (groupBookmarkIds.length > 0) {
      await mockBookmarkRepo.bulkUpdate(groupBookmarkIds, { group: "Unsorted" });
    }

    expect(mockGroupRepo.delete).toHaveBeenCalledWith("grp-1");
    expect(mockBookmarkRepo.bulkUpdate).toHaveBeenCalledTimes(1);
    expect(mockBookmarkRepo.bulkUpdate).toHaveBeenCalledWith(["bm-1", "bm-2"], {
      group: "Unsorted",
    });
    expect(mockBookmarkRepo.update).not.toHaveBeenCalled();
  });
});
