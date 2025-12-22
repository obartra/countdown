import path from "node:path";
import { promises as fs } from "node:fs";

const DEFAULT_TMP_ROOT = path.resolve("/tmp", ".netlify", "published-data");
const ROOT_DIR = process.env.COUNTDOWN_STORAGE_DIR || DEFAULT_TMP_ROOT;
const BLOB_STORE_NAME = process.env.COUNTDOWN_BLOB_STORE || "countdown";
const storageDriver = (
  process.env.COUNTDOWN_STORAGE_DRIVER || ""
).toLowerCase();
const USE_NETLIFY_BLOBS =
  storageDriver === "blobs"
    ? true
    : storageDriver === "fs"
      ? false
      : process.env.NETLIFY === "true" && process.env.NETLIFY_DEV !== "true";
let blobStorePromise: Promise<any> | null = null;

const hasBlobsContext = () =>
  Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext,
  );

const getManualStoreOptions = () => {
  const siteID =
    process.env.COUNTDOWN_BLOBS_SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID;
  const token =
    process.env.COUNTDOWN_BLOBS_TOKEN ||
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_API_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) return null;
  const apiURL =
    process.env.COUNTDOWN_BLOBS_API_URL || process.env.NETLIFY_API_URL;
  return {
    name: BLOB_STORE_NAME,
    siteID,
    token,
    apiURL,
  };
};

const getBlobStore = async () => {
  if (!blobStorePromise) {
    blobStorePromise = import("@netlify/blobs").then(({ getStore }) => {
      const manualOptions = getManualStoreOptions();
      if (manualOptions) {
        return getStore(manualOptions);
      }
      if (!hasBlobsContext()) {
        throw new Error(
          "Netlify Blobs context missing. Set COUNTDOWN_BLOBS_SITE_ID and COUNTDOWN_BLOBS_TOKEN or enable Blobs context.",
        );
      }
      return getStore(BLOB_STORE_NAME);
    });
  }
  return blobStorePromise;
};

const resolvePath = (segments: string[]) => path.join(ROOT_DIR, ...segments);
const buildKey = (segments: string[]) => segments.filter(Boolean).join("/");
const ensurePrefix = (value: string) => (value ? `${value}/` : "");

const ensureParentDir = async (segments: string[]) => {
  await fs.mkdir(path.dirname(resolvePath(segments)), { recursive: true });
};

export const ensureDirectory = async (segments: string[]) => {
  if (USE_NETLIFY_BLOBS) return;
  await fs.mkdir(resolvePath(segments), { recursive: true });
};

const readFile = async (segments: string[]) => {
  try {
    const filePath = resolvePath(segments);
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
};

const writeFile = async (segments: string[], data: string) => {
  await ensureParentDir(segments);
  await fs.writeFile(resolvePath(segments), data, "utf-8");
};

const deleteFile = async (segments: string[]) => {
  try {
    await fs.unlink(resolvePath(segments));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
};

const listDirectoryFs = async (segments: string[]) => {
  try {
    const dirPath = resolvePath(segments);
    return await fs.readdir(dirPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return [];
      }
    }
    throw error;
  }
};

export const readJsonBlob = async <T>(
  segments: string[],
): Promise<T | null> => {
  if (USE_NETLIFY_BLOBS) {
    const store = await getBlobStore();
    const value = await store.get(buildKey(segments), { type: "text" });
    if (!value) return null;
    return JSON.parse(String(value)) as T;
  }
  const file = await readFile(segments);
  if (!file) return null;
  return JSON.parse(file) as T;
};

export const writeJsonBlob = async (segments: string[], data: unknown) => {
  if (USE_NETLIFY_BLOBS) {
    const store = await getBlobStore();
    await store.set(buildKey(segments), JSON.stringify(data, null, 2));
    return;
  }
  await writeFile(segments, JSON.stringify(data, null, 2));
};

export const readTextBlob = async (
  segments: string[],
): Promise<string | null> => {
  if (USE_NETLIFY_BLOBS) {
    const store = await getBlobStore();
    const value = await store.get(buildKey(segments), { type: "text" });
    if (!value) return null;
    return String(value);
  }
  return readFile(segments);
};

export const writeTextBlob = async (segments: string[], data: string) => {
  if (USE_NETLIFY_BLOBS) {
    const store = await getBlobStore();
    await store.set(buildKey(segments), data);
    return;
  }
  await writeFile(segments, data);
};

export const deleteBlob = async (segments: string[]) => {
  if (USE_NETLIFY_BLOBS) {
    const store = await getBlobStore();
    await store.delete(buildKey(segments));
    return;
  }
  await deleteFile(segments);
};

const listBlobKeys = async (prefix: string) => {
  const store = await getBlobStore();
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await store.list({ prefix, cursor });
    const blobs = result?.blobs ?? result?.objects ?? result?.keys ?? [];
    for (const entry of blobs) {
      if (typeof entry === "string") {
        keys.push(entry);
      } else if (entry && typeof entry.key === "string") {
        keys.push(entry.key);
      }
    }
    const nextCursor = result?.nextCursor ?? result?.cursor ?? result?.next;
    cursor =
      typeof nextCursor === "string" && nextCursor ? nextCursor : undefined;
  } while (cursor);
  return keys;
};

export const listDirectory = async (segments: string[]) => {
  if (!USE_NETLIFY_BLOBS) {
    return listDirectoryFs(segments);
  }
  const prefix = ensurePrefix(buildKey(segments));
  const keys = await listBlobKeys(prefix);
  const entries = new Set<string>();
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    const remainder = key.slice(prefix.length);
    if (!remainder) continue;
    const [entry] = remainder.split("/");
    if (entry) entries.add(entry);
  }
  return Array.from(entries);
};
export const storageRoot = ROOT_DIR;
