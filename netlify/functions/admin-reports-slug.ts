import type { Handler } from "@netlify/functions";
import {
  computeReportIndexFromReports,
  readReportIndex,
  type ReportIndexEntry,
} from "./lib/reportIndex";
import { deleteBlob, listDirectory, writeJsonBlob } from "./lib/blobStorage";
import { logAdminAction } from "./lib/logger";
import { checkAdminAuth } from "./lib/adminAuth";

const jsonResponse = (
  statusCode: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  },
  body: JSON.stringify(body),
});

const methodNotAllowed = () =>
  jsonResponse(405, { error: "Method not allowed" });
const unauthorized = () => jsonResponse(401, { error: "Unauthorized" });
const badRequest = (message: string) => jsonResponse(400, { error: message });
const notFound = () => jsonResponse(404, { error: "Not found" });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "PATCH" && event.httpMethod !== "DELETE") {
    return methodNotAllowed();
  }

  const auth = checkAdminAuth(event.headers);
  if (!auth.authorized) {
    console.warn("Admin slug auth failed", {
      provided: auth.providedLabel,
      envPresent: auth.hasConfiguredSecret,
    });
    return unauthorized();
  }

  const slug = event.queryStringParameters?.slug;
  if (!slug) {
    return badRequest("Slug is required");
  }

  if (event.httpMethod === "PATCH") {
    let entry: ReportIndexEntry | null = await readReportIndex(slug);
    if (!entry) {
      entry = await computeReportIndexFromReports(slug);
    }

    if (!entry) {
      return notFound();
    }

    const updated: ReportIndexEntry = {
      ...entry,
      reviewed: true,
    };

    await writeJsonBlob(["reports-index", `${slug}.json`], updated);
    return jsonResponse(200, { slug, reviewed: true });
  }

  // Keep first/last timestamps for audit context; only counts/reason/reset reviewed.
  const purgeBlobs =
    (event.queryStringParameters?.purgeBlobs || "").toLowerCase() === "true";

  let existing = await readReportIndex(slug);
  if (!existing) {
    existing = await computeReportIndexFromReports(slug);
  }

  if (!existing) {
    return notFound();
  }

  const cleared: ReportIndexEntry = {
    slug,
    reportCount: 0,
    firstReportedAt: existing.firstReportedAt,
    lastReportedAt: existing.lastReportedAt,
    lastReason: "",
    reviewed: true,
  };

  await writeJsonBlob(["reports-index", `${slug}.json`], cleared);

  if (purgeBlobs) {
    const files = await listDirectory(["reports", slug]);
    for (const file of files) {
      await deleteBlob(["reports", slug, file]);
    }
  }

  await logAdminAction({
    action: purgeBlobs ? "clear_purge" : "clear",
    slug,
    actor: "admin",
  });

  return jsonResponse(200, { slug, cleared: true, purged: purgeBlobs });
};
