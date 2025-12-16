export type SearchResult = {
  id: string; // provider:id
  thumb: string;
  title: string;
  provider: "openverse" | "tenor";
  isTransparent?: boolean;
};

type OpenverseResult = {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  thumbnail_width?: number;
  thumbnail_height?: number;
};

type TenorMediaFormat = {
  url?: string;
  dims?: [number, number];
  transparent?: boolean;
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

export const searchOpenverse = async (
  query: string,
  page = 1,
  pageSize = 12,
) => {
  const params = new URLSearchParams({
    q: query,
    extension: "svg",
    license: "pdm,cc0,by,by-sa,by-nd",
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  const headers: Record<string, string> = {};
  const token = import.meta.env.VITE_IMAGE_API_KEY_OPENVERSE;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(
    `${OPENVERSE_HOST}/v1/images?${params.toString()}`,
    {
      headers,
    },
  );
  if (!response.ok) throw new Error("Openverse search failed");
  const data: {
    results: OpenverseResult[];
    next?: string | null;
  } = await response.json();
  const results: SearchResult[] = (data.results || [])
    .filter((item) => {
      const width = item.width || item.thumbnail_width;
      const height = item.height || item.thumbnail_height;
      if (!width || !height) return true;
      return width >= 200 && height >= 200;
    })
    .map((item) => ({
      id: `openverse:${item.id}`,
      thumb: item.thumbnail || item.url,
      title: item.title || "Openverse image",
      provider: "openverse",
      isTransparent: true, // SVGs are typically transparent
    }));
  return { results, nextPage: data.next ? page + 1 : null };
};

export const searchTenor = async (
  query: string,
  pos = "",
  limit = 12,
  contentFilter: "off" | "low" | "medium" | "high" = "off",
) => {
  const key = import.meta.env.VITE_IMAGE_API_KEY_TENOR;
  if (!key) throw new Error("Tenor API key missing");
  const params = new URLSearchParams({
    q: query,
    // Use full Tenor catalog (not limited to stickers).
    limit: limit.toString(),
    key,
    client_key: TENOR_CLIENT_KEY,
    contentfilter: contentFilter,
  });
  if (pos) params.set("pos", pos);
  const response = await fetch(`${TENOR_HOST}/v2/search?${params.toString()}`);
  if (!response.ok) throw new Error("Tenor search failed");
  const data = await response.json();
  const results: SearchResult[] = (data.results || [])
    .filter((item) => {
      const mediaFormats = (item.media_formats ||
        item.media ||
        (item.media ? item.media[0] : undefined)) as
        | Record<string, TenorMediaFormat>
        | TenorMediaFormat
        | undefined;
      const formatValues = Array.isArray(mediaFormats)
        ? mediaFormats
        : mediaFormats
          ? Object.values(mediaFormats)
          : [];
      const dims = formatValues
        .map((entry) => entry?.dims)
        .filter((value): value is [number, number] => Boolean(value));
      if (!dims.length) return true;
      const [maxW, maxH] = dims.reduce(
        (acc, [w, h]) => [Math.max(acc[0], w), Math.max(acc[1], h)],
        [0, 0],
      );
      return maxW >= 200 && maxH >= 200;
    })
    .map((item) => {
      const thumb =
        item.media_formats?.nanogif?.url || item.media_formats?.tinygif?.url;
      const mediaFormats = (item.media_formats ||
        item.media ||
        (item.media ? item.media[0] : undefined)) as
        | Record<string, TenorMediaFormat>
        | TenorMediaFormat
        | undefined;
      const formatValues = Array.isArray(mediaFormats)
        ? mediaFormats
        : mediaFormats
          ? Object.values(mediaFormats)
          : [];
      const hasTransparency =
        formatValues.some((entry) => entry?.transparent) ||
        item.has_transparency === true ||
        item.bg_color === "transparent";
      return {
        id: `tenor:${item.id}`,
        thumb:
          thumb ||
          item.media?.[0]?.nanogif?.url ||
          item.media?.[0]?.tinygif?.url ||
          "",
        title: item.title || "Tenor sticker",
        provider: "tenor",
        isTransparent: Boolean(hasTransparency),
      };
    });
  return { results, next: data.next || data.next_pos || null };
};
