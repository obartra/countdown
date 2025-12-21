import type { Handler } from "@netlify/functions";
import { storageClient } from "./lib/storage";
import { logCleanup } from "./lib/logger";
import { ensureBlobsEnvironment } from "./lib/blobsEnvironment";

const methodNotAllowed = () => ({
  statusCode: 405,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: "Method not allowed" }),
});

export const handler: Handler = async (event) => {
  ensureBlobsEnvironment(event);
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const now = Date.now();
  const metas = await storageClient.listMeta();
  const removed: string[] = [];

  for (const meta of metas) {
    const payload = await storageClient.readPayload(meta.slug);
    const expired = meta.expiresAt && meta.expiresAt <= now;
    if (expired || !payload) {
      await storageClient.deleteMeta(meta.slug);
      await storageClient.deletePayload(meta.slug);
      removed.push(meta.slug);
    }
  }

  await logCleanup({ removed: removed.length, scanned: metas.length });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removed, checked: metas.length }),
  };
};
