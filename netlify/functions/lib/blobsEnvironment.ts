import { connectLambda } from "@netlify/blobs";

type LambdaBlobsEvent = {
  blobs?: string;
  headers?: Record<string, string>;
};

let initialized = false;

const hasEnvironmentContext = () =>
  Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext,
  );

export const ensureBlobsEnvironment = (event?: LambdaBlobsEvent) => {
  if (initialized || hasEnvironmentContext()) {
    initialized = true;
    return;
  }

  if (!event?.blobs || !event.headers) return;

  try {
    connectLambda({ blobs: event.blobs, headers: event.headers });
    initialized = true;
  } catch (error) {
    console.warn("Failed to initialize Netlify Blobs context", error);
  }
};
