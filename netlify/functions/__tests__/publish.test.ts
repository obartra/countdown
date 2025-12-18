import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const ANON_SLUG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CUSTOM_SLUG_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const ADMIN_SECRET = "super-secret";

const createPublishEvent = (body: object) => ({
  version: "1.0",
  rawPath: "/publish",
  rawQuery: "",
  path: "/publish",
  httpMethod: "POST",
  headers: {
    host: "localhost:8080",
    "x-forwarded-proto": "https",
  },
  multiValueHeaders: {},
  queryStringParameters: {},
  multiValueQueryStringParameters: {},
  requestContext: {} as any,
  body: JSON.stringify(body),
  isBase64Encoded: false,
  cookies: [],
});

const createPublishedEvent = (
  slug: string,
  method: "GET" | "DELETE" | "POST",
  body?: object,
  extraQuery?: Record<string, string>,
  extraHeaders?: Record<string, string>,
) => ({
  version: "1.0",
  rawPath: `/v/${slug}`,
  rawQuery: "",
  path: `/v/${slug}`,
  httpMethod: method,
  headers: {
    host: "localhost:8080",
    "x-forwarded-proto": "https",
    ...(extraHeaders ?? {}),
  },
  multiValueHeaders: {},
  queryStringParameters: { slug, ...(extraQuery ?? {}) },
  multiValueQueryStringParameters: {},
  requestContext: {} as any,
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  cookies: [],
});

const loadHandlers = async () => {
  const publishModule = await import("../publish");
  const publishedModule = await import("../published");
  return {
    publishHandler: publishModule.handler,
    publishedHandler: publishedModule.handler,
  };
};

describe("publish backend", () => {
  let storageDir: string;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "countdown-test-"));
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    delete process.env.ADMIN_SECRET;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  test("POST /publish stores canonical payload", async () => {
    const { publishHandler } = await loadHandlers();
    const canonicalSearch = "time=2026-01-01T00:00:00.000Z&title=Lunch";
    const event = createPublishEvent({ canonicalSearch });

    const response = await publishHandler(event);
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.slug).toBeDefined();
    expect(payload.shortUrl).toContain(payload.slug);

    const metaPath = path.join(storageDir, "meta", `${payload.slug}.json`);
    const payloadPath = path.join(storageDir, "slug", `${payload.slug}.txt`);
    const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    expect(meta.slug).toBe(payload.slug);
    expect(meta.expiresAt - meta.createdAt).toBe(ANON_SLUG_TTL_MS);
    const storedPayload = await fs.readFile(payloadPath, "utf-8");
    expect(storedPayload).toBe(canonicalSearch);
  });

  test("POST /publish rejects invalid slug", async () => {
    const { publishHandler } = await loadHandlers();
    const event = createPublishEvent({
      canonicalSearch: "time=2026-02-01T00:00:00.000Z",
      slug: "Bad Slug",
    });

    const response = await publishHandler(event);
    expect(response.statusCode).toBe(400);
  });

  test("GET /v/:slug returns published payload", async () => {
    const { publishHandler, publishedHandler } = await loadHandlers();
    const canonicalSearch = "time=2026-06-01T00:00:00.000Z";
    const slug = "friendly-slug";

    await publishHandler(
      createPublishEvent({
        canonicalSearch,
        slug,
        password: "ownersecret",
      }),
    );
    const metaPath = path.join(storageDir, "meta", `${slug}.json`);
    const response = await publishedHandler(createPublishedEvent(slug, "GET"));
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.payload).toBe(canonicalSearch);
    expect(body.meta.slug).toBe(slug);
    const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    expect(meta.expiresAt - meta.createdAt).toBe(CUSTOM_SLUG_TTL_MS);
  });

  test("DELETE /v/:slug enforces password when set", async () => {
    const { publishHandler, publishedHandler } = await loadHandlers();
    const canonicalSearch = "time=2026-12-01T00:00:00.000Z";
    const slug = "customslug";

    await publishHandler(
      createPublishEvent({
        canonicalSearch,
        slug,
        password: "secret",
      }),
    );

    const wrongPassword = await publishedHandler(
      createPublishedEvent(slug, "DELETE", { password: "wrong" }),
    );
    expect(wrongPassword.statusCode).toBe(401);

    const success = await publishedHandler(
      createPublishedEvent(slug, "DELETE", { password: "secret" }),
    );
    expect(success.statusCode).toBe(200);
  });

  test("POST /v/:slug?action=verify validates the password", async () => {
    const { publishHandler, publishedHandler } = await loadHandlers();
    const canonicalSearch = "time=2026-12-01T00:00:00.000Z";
    const slug = "verify-slug";

    await publishHandler(
      createPublishEvent({
        canonicalSearch,
        slug,
        password: "secret",
      }),
    );

    const wrong = await publishedHandler(
      createPublishedEvent(
        slug,
        "POST",
        { password: "wrong" },
        { action: "verify" },
      ),
    );
    expect(wrong.statusCode).toBe(401);

    const success = await publishedHandler(
      createPublishedEvent(
        slug,
        "POST",
        { password: "secret" },
        { action: "verify" },
      ),
    );
    expect(success.statusCode).toBe(200);
    const body = JSON.parse(success.body);
    expect(body.verified).toBe(true);
  });

  test("POST /publish enforces rate limits", async () => {
    const { publishHandler } = await loadHandlers();
    const ip = "203.0.113.5";
    const canonicalTime = "time=2024-01-01T00:00:00.000Z";
    for (let i = 0; i < 10; i += 1) {
      const event = createPublishEvent({
        canonicalSearch: `${canonicalTime}&title=Rate${i}`,
      });
      event.headers["x-nf-client-connection-ip"] = ip;
      const response = await publishHandler(event);
      expect(response.statusCode).toBe(200);
    }

    const blockedEvent = createPublishEvent({
      canonicalSearch: `${canonicalTime}&title=Rate-limit`,
    });
    blockedEvent.headers["x-nf-client-connection-ip"] = ip;
    const blocked = await publishHandler(blockedEvent);
    expect(blocked.statusCode).toBe(429);
    const body = JSON.parse(blocked.body);
    expect(body.error).toContain("Too many publishes");
    expect(blocked.headers["Retry-After"]).toBeDefined();
  });

  test("DELETE /v/:slug locks after repeated bad passwords", async () => {
    const { publishHandler, publishedHandler } = await loadHandlers();
    const canonicalSearch = "time=2024-01-01T00:00:00.000Z";
    const slug = "lock-slug";

    await publishHandler(
      createPublishEvent({
        canonicalSearch,
        slug,
        password: "secret",
      }),
    );

    for (let i = 0; i < 5; i += 1) {
      const response = await publishedHandler(
        createPublishedEvent(slug, "DELETE", { password: "wrong" }),
      );
      expect(response.statusCode).toBe(401);
    }

    const lockedOut = await publishedHandler(
      createPublishedEvent(slug, "DELETE", { password: "wrong" }),
    );
    expect(lockedOut.statusCode).toBe(429);
    const body = JSON.parse(lockedOut.body);
    expect(body.error).toContain("Too many failed attempts");
    expect(lockedOut.headers["Retry-After"]).toBeDefined();
  });

  test("DELETE /v/:slug allows admin override without password", async () => {
    const { publishHandler, publishedHandler } = await loadHandlers();
    const slug = "admin-delete";
    await publishHandler(
      createPublishEvent({
        canonicalSearch: "time=2026-12-01T00:00:00.000Z&title=Admin",
        slug,
        password: "secret",
      }),
    );

    const response = await publishedHandler(
      createPublishedEvent(slug, "DELETE", undefined, undefined, {
        "x-admin-override": ADMIN_SECRET,
      }),
    );
    expect(response.statusCode).toBe(200);
    const metaPath = path.join(storageDir, "meta", `${slug}.json`);
    const metaExists = await fs
      .readFile(metaPath, "utf-8")
      .then(() => true)
      .catch(() => false);
    expect(metaExists).toBe(false);
  });

  test("POST /publish updates an existing protected slug when password matches", async () => {
    const { publishHandler } = await loadHandlers();
    const slug = "update-me";
    const first = await publishHandler(
      createPublishEvent({
        canonicalSearch: "time=2026-12-01T00:00:00.000Z&title=First",
        slug,
        password: "secret",
      }),
    );
    expect(first.statusCode).toBe(200);

    const secondCanonical =
      "time=2027-01-01T00:00:00.000Z&title=Second&footer=Updated";
    const second = await publishHandler(
      createPublishEvent({
        canonicalSearch: secondCanonical,
        slug,
        password: "secret",
      }),
    );
    expect(second.statusCode).toBe(200);

    const payloadPath = path.join(storageDir, "slug", `${slug}.txt`);
    const storedPayload = await fs.readFile(payloadPath, "utf-8");
    expect(storedPayload).toBe(secondCanonical);
  });

  test("POST /publish rejects updates when password is incorrect", async () => {
    const { publishHandler } = await loadHandlers();
    const slug = "update-denied";
    const firstCanonical = "time=2026-12-01T00:00:00.000Z&title=First";
    const first = await publishHandler(
      createPublishEvent({
        canonicalSearch: firstCanonical,
        slug,
        password: "secret",
      }),
    );
    expect(first.statusCode).toBe(200);

    const second = await publishHandler(
      createPublishEvent({
        canonicalSearch: "time=2027-01-01T00:00:00.000Z&title=Second",
        slug,
        password: "wrong",
      }),
    );
    expect(second.statusCode).toBe(401);

    const payloadPath = path.join(storageDir, "slug", `${slug}.txt`);
    const storedPayload = await fs.readFile(payloadPath, "utf-8");
    expect(storedPayload).toBe(firstCanonical);
  });

  test("POST /publish keeps anonymous slugs immutable", async () => {
    const { publishHandler } = await loadHandlers();
    const first = await publishHandler(
      createPublishEvent({
        canonicalSearch: "time=2026-12-01T00:00:00.000Z&title=Anon",
      }),
    );
    expect(first.statusCode).toBe(200);
    const payload = JSON.parse(first.body);
    expect(payload.slug).toBeDefined();

    const second = await publishHandler(
      createPublishEvent({
        canonicalSearch: "time=2026-12-01T00:00:00.000Z&title=Attempted",
        slug: payload.slug,
        password: "secret",
      }),
    );
    expect(second.statusCode).toBe(409);
  });
});
