import type { Handler } from "@netlify/functions";

const OPENVERSE_API = "https://api.openverse.engineering";

export const handler: Handler = async (event) => {
  const path = event.path.replace(
    /^\/\.netlify\/functions\/openverse-proxy/,
    "",
  );
  const url = `${OPENVERSE_API}${path}${event.rawQuery ? `?${event.rawQuery}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: {
        ...(process.env.VITE_IMAGE_API_KEY_OPENVERSE
          ? {
              Authorization: `Bearer ${process.env.VITE_IMAGE_API_KEY_OPENVERSE}`,
            }
          : {}),
      },
    });

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Cache-Control":
          res.headers.get("cache-control") || "public, max-age=300",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Openverse proxy error", error);
    return { statusCode: 500, body: "Proxy error" };
  }
};
