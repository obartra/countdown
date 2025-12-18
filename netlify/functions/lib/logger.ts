import { readJsonBlob, writeJsonBlob } from "./blobStorage";

// Admin audit log format: one JSON array per day at logs/<date>/admin-actions.json
// with each action appended as an object.

const formatDate = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10);

const writeLog = async (type: string, payload: Record<string, unknown>) => {
  const timestamp = Date.now();
  const dateSegment = formatDate(timestamp);
  const segments = ["logs", dateSegment, `${type}-${timestamp}.json`];
  const entry = {
    timestamp,
    type,
    ...payload,
  };
  await writeJsonBlob(segments, entry);
  console.info(JSON.stringify(entry));
};

type LogSlugType = "anonymous" | "custom" | "unknown";

export const logPublish = async (data: {
  ipHash?: string;
  slugType: LogSlugType;
  outcome: string;
  slug?: string;
}) => {
  await writeLog("publish", data);
};

export const logDelete = async (data: { slug: string; outcome: string }) => {
  await writeLog("delete", {
    outcome: data.outcome,
    slug: data.slug,
  });
};

export const logCleanup = async (data: {
  removed: number;
  scanned: number;
}) => {
  await writeLog("cleanup", data);
};

type AdminAction = {
  action: "delete" | "clear" | "clear_purge" | "delete-override-failed";
  slug: string;
  actor?: string;
  outcome?: string;
};

export const logAdminAction = async (data: AdminAction) => {
  const timestampMs = Date.now();
  const timestamp = new Date(timestampMs).toISOString();
  const dateSegment = formatDate(timestampMs);
  const segments = ["logs", dateSegment, "admin-actions.json"];
  const existing = (await readJsonBlob<AdminAction[]>(segments)) ?? [];
  const entry = {
    ...data,
    timestamp,
  };
  await writeJsonBlob(segments, [...existing, entry]);
  console.info(JSON.stringify({ type: "admin_action", ...entry }));
};
