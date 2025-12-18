import {
  deleteBlob,
  ensureDirectory,
  listDirectory,
  readJsonBlob,
  readTextBlob,
  writeJsonBlob,
  writeTextBlob,
} from "./blobStorage";

const META_DIR_SEGMENTS = ["meta"];
const SLUG_DIR_SEGMENTS = ["slug"];

export type PublicationMeta = {
  slug: string;
  createdAt: number;
  timeMs: number;
  expiresAt: number;
  published: boolean;
  ownerHash?: string;
};

export type PublicationRecord = {
  meta: PublicationMeta;
  payload: string;
};

export interface StorageClient {
  readMeta(slug: string): Promise<PublicationMeta | null>;
  writeMeta(slug: string, meta: PublicationMeta): Promise<void>;
  deleteMeta(slug: string): Promise<void>;
  readPayload(slug: string): Promise<string | null>;
  writePayload(slug: string, payload: string): Promise<void>;
  deletePayload(slug: string): Promise<void>;
  listMeta(): Promise<PublicationMeta[]>;
}

class LocalStorageClient implements StorageClient {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.ensureDirectories();
  }

  private async ensureDirectories() {
    await ensureDirectory(META_DIR_SEGMENTS);
    await ensureDirectory(SLUG_DIR_SEGMENTS);
  }

  private async ensureReady() {
    await this.ready;
  }

  async readMeta(slug: string) {
    await this.ensureReady();
    return readJsonBlob<PublicationMeta>([
      ...META_DIR_SEGMENTS,
      `${slug}.json`,
    ]);
  }

  async writeMeta(slug: string, meta: PublicationMeta) {
    await this.ensureReady();
    await writeJsonBlob([...META_DIR_SEGMENTS, `${slug}.json`], meta);
  }

  async deleteMeta(slug: string) {
    await this.ensureReady();
    await deleteBlob([...META_DIR_SEGMENTS, `${slug}.json`]);
  }

  async readPayload(slug: string) {
    await this.ensureReady();
    return readTextBlob([...SLUG_DIR_SEGMENTS, `${slug}.txt`]);
  }

  async writePayload(slug: string, payload: string) {
    await this.ensureReady();
    await writeTextBlob([...SLUG_DIR_SEGMENTS, `${slug}.txt`], payload);
  }

  async deletePayload(slug: string) {
    await this.ensureReady();
    await deleteBlob([...SLUG_DIR_SEGMENTS, `${slug}.txt`]);
  }

  async listMeta() {
    await this.ensureReady();
    const files = await listDirectory(META_DIR_SEGMENTS);
    const metas: PublicationMeta[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const slug = file.replace(/\.json$/, "");
      const meta = await this.readMeta(slug);
      if (meta) {
        metas.push(meta);
      }
    }
    return metas;
  }
}

export const storageClient: StorageClient = new LocalStorageClient();
