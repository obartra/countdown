export type ImageAttribution = {
  text: string;
  href?: string;
  provider: "openverse" | "tenor";
};

export type ResolvedImage = {
  url: string;
  alt?: string;
  attribution?: ImageAttribution;
};

const cleanBase = (value: string) => value.replace(/\/+$/, "");
const OPENVERSE_HOST =
  cleanBase(
    import.meta.env.VITE_OPENVERSE_BASE ||
      (import.meta.env.DEV
        ? "/api/openverse"
        : "https://api.openverse.engineering"),
  ) || "https://api.openverse.engineering";
const TENOR_HOST = cleanBase(
  import.meta.env.VITE_TENOR_BASE || "https://tenor.googleapis.com",
);
const TENOR_CLIENT_KEY =
  import.meta.env.VITE_TENOR_CLIENT_KEY || "countdown-app";

const patterns = {
  openverse: /^[0-9a-fA-F-]{36}$/,
  tenor: /^[A-Za-z0-9_-]+$/,
};

type Provider = "openverse" | "tenor";

const pickTenorMediaUrl = (mediaFormats: Record<string, { url: string }>) => {
  // Prefer larger/standard GIFs first; fall back to smaller/light formats.
  const preferred = [
    "gif",
    "mediumgif",
    "tinygif",
    "nanogif",
    "mp4",
    "tinymp4",
    "nanomp4",
  ];
  for (const key of preferred) {
    const entry = mediaFormats[key];
    if (entry?.url) return entry.url;
  }
  const first = Object.values(mediaFormats)[0];
  return first?.url || "";
};

export const parseImageId = (
  value: string,
): { provider: Provider; id: string } | null => {
  const [provider, id] = value.split(":");
  if (!provider || !id) return null;
  if (provider !== "openverse" && provider !== "tenor") return null;
  const pattern = patterns[provider];
  if (!pattern.test(id)) return null;
  return { provider, id } as const;
};

export const resolveImage = async (
  imageValue: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedImage> => {
  const parsed = parseImageId(imageValue);
  if (!parsed) {
    throw new Error("Unsupported image identifier");
  }

  if (parsed.provider === "openverse") {
    const url = `${OPENVERSE_HOST}/v1/images/${parsed.id}`;
    const headers: Record<string, string> = {};
    const token = import.meta.env.VITE_IMAGE_API_KEY_OPENVERSE;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, { headers });
    if (!response.ok) throw new Error("Openverse lookup failed");
    const data = await response.json();
    const imageUrl: string = data.url || data.thumbnail;
    if (!imageUrl) throw new Error("Openverse image missing URL");
    const alt = data.title || "Openverse image";
    const attribution: ImageAttribution = {
      text: `${data.title || "Untitled"} by ${data.creator || "Unknown"} (Openverse)`,
      href: data.foreign_landing_url || data.url,
      provider: "openverse",
    };
    return { url: imageUrl, alt, attribution };
  }

  // Tenor
  const tenorKey = import.meta.env.VITE_IMAGE_API_KEY_TENOR;
  if (!tenorKey) {
    throw new Error("Tenor API key missing");
  }
  const detailUrl = `${TENOR_HOST}/v2/posts?ids=${encodeURIComponent(parsed.id)}&key=${encodeURIComponent(
    tenorKey,
  )}&client_key=${encodeURIComponent(TENOR_CLIENT_KEY)}`;
  const response = await fetchImpl(detailUrl);
  if (!response.ok) throw new Error("Tenor lookup failed");
  const data = await response.json();
  const first = data.results?.[0] || data?.["results"]?.[0];
  const mediaFormats =
    first?.media_formats || first?.media || first?.media?.[0];
  const resolvedUrl = mediaFormats ? pickTenorMediaUrl(mediaFormats) : "";
  if (!resolvedUrl) throw new Error("Tenor image missing media url");
  const alt = first?.title || "Tenor sticker";
  const attribution: ImageAttribution = {
    text: "Powered by Tenor",
    provider: "tenor",
    href: "https://tenor.com",
  };
  return { url: resolvedUrl, alt, attribution };
};
