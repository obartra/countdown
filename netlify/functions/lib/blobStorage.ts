import path from "node:path";
import { promises as fs } from "node:fs";

const DEFAULT_TMP_ROOT = path.resolve("/tmp", ".netlify", "published-data");
const ROOT_DIR = process.env.COUNTDOWN_STORAGE_DIR || DEFAULT_TMP_ROOT;

const resolvePath = (segments: string[]) => path.join(ROOT_DIR, ...segments);

const ensureParentDir = async (segments: string[]) => {
  await fs.mkdir(path.dirname(resolvePath(segments)), { recursive: true });
};

export const ensureDirectory = async (segments: string[]) => {
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

const listDirectory = async (segments: string[]) => {
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
  const file = await readFile(segments);
  if (!file) return null;
  return JSON.parse(file) as T;
};

export const writeJsonBlob = async (segments: string[], data: unknown) => {
  await writeFile(segments, JSON.stringify(data, null, 2));
};

export const readTextBlob = async (
  segments: string[],
): Promise<string | null> => {
  return readFile(segments);
};

export const writeTextBlob = async (segments: string[], data: string) => {
  await writeFile(segments, data);
};

export { deleteFile as deleteBlob, listDirectory };
export const storageRoot = ROOT_DIR;
