import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ blobs: [] })),
  })),
}));

const clearEnv = () => {
  delete process.env.COUNTDOWN_STORAGE_DRIVER;
  delete process.env.COUNTDOWN_BLOBS_SITE_ID;
  delete process.env.COUNTDOWN_BLOBS_TOKEN;
  delete process.env.COUNTDOWN_BLOBS_API_URL;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
};

const clearGlobalContext = () => {
  delete (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext;
};

describe("blob storage Netlify Blobs config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clearEnv();
    clearGlobalContext();
  });

  afterEach(() => {
    clearEnv();
    clearGlobalContext();
  });

  it("uses manual Blobs credentials when provided", async () => {
    process.env.COUNTDOWN_STORAGE_DRIVER = "blobs";
    process.env.COUNTDOWN_BLOBS_SITE_ID = "site-123";
    process.env.COUNTDOWN_BLOBS_TOKEN = "token-abc";
    process.env.COUNTDOWN_BLOBS_API_URL = "https://api.example.com";

    const blobStorage = await import("./blobStorage");
    await blobStorage.readJsonBlob(["meta", "demo.json"]);

    const { getStore } = await import("@netlify/blobs");
    expect(getStore).toHaveBeenCalledWith({
      name: "countdown",
      siteID: "site-123",
      token: "token-abc",
      apiURL: "https://api.example.com",
    });
  });

  it("throws when Blobs context is missing and no manual creds are set", async () => {
    process.env.COUNTDOWN_STORAGE_DRIVER = "blobs";

    const blobStorage = await import("./blobStorage");
    await expect(
      blobStorage.readJsonBlob(["meta", "demo.json"]),
    ).rejects.toThrow(/Netlify Blobs context missing/i);
  });
});
