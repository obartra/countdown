import { DEFAULT_COMPLETE_TEXT, deriveColors } from "./countdown";

export type CountdownQueryInput = {
  time?: string | null;
  title?: string | null;
  description?: string | null;
  footer?: string | null;
  complete?: string | null;
  image?: string | null;
  bgcolor?: string | null;
  color?: string | null;
};

const COUNTDOWN_QUERY_KEYS = new Set([
  "time",
  "date",
  "title",
  "description",
  "footer",
  "complete",
  "image",
  "bgcolor",
  "color",
]);

const trimToUndefined = (value?: string | null) => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const expandHexTriplet = (hex: string) =>
  hex
    .split("")
    .map((char) => char + char)
    .join("");

const getRGBAFromCssColor = (
  color: string,
): { r: number; g: number; b: number; a: number } | null => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (
    !ctx ||
    typeof ctx.fillRect !== "function" ||
    typeof ctx.getImageData !== "function"
  ) {
    return null;
  }

  const sentinels = ["#010203", "#040506"];
  let isValid = false;
  for (const sentinel of sentinels) {
    ctx.fillStyle = sentinel;
    const before = ctx.fillStyle;
    ctx.fillStyle = color;
    if (ctx.fillStyle !== before) {
      isValid = true;
      break;
    }
  }

  if (!isValid) return null;

  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`.toLowerCase();

const normalizeColorToHex = (raw: string): string => {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{3}$/.test(candidate)) {
    return `#${expandHexTriplet(candidate).toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(candidate)) {
    return `#${candidate.toLowerCase()}`;
  }

  const rgba = getRGBAFromCssColor(trimmed);
  if (!rgba) return trimmed;
  if (rgba.a !== 255) return trimmed;
  return rgbToHex(rgba);
};

const normalizeRenderedPair = (
  bg: string | null,
  text: string | null,
): { bg: string; text: string } => {
  const derived = deriveColors(bg, text);
  return {
    bg: normalizeColorToHex(derived.backgroundColor),
    text: normalizeColorToHex(derived.textColor),
  };
};

const reduceColorOverrides = (bg?: string, text?: string) => {
  if (!bg && !text) return { bgcolor: undefined, color: undefined };
  if (!bg || !text) return { bgcolor: bg, color: text };

  const both = normalizeRenderedPair(bg, text);
  const none = normalizeRenderedPair(null, null);
  if (both.bg === none.bg && both.text === none.text) {
    return { bgcolor: undefined, color: undefined };
  }

  const bgOnly = normalizeRenderedPair(bg, null);
  if (bgOnly.bg === both.bg && bgOnly.text === both.text) {
    return { bgcolor: bg, color: undefined };
  }

  const textOnly = normalizeRenderedPair(null, text);
  if (textOnly.bg === both.bg && textOnly.text === both.text) {
    return { bgcolor: undefined, color: text };
  }

  return { bgcolor: bg, color: text };
};

export const buildCanonicalCountdownSearchParams = (
  input: CountdownQueryInput,
): URLSearchParams => {
  const time = trimToUndefined(input.time);
  const title = trimToUndefined(input.title);
  const description = trimToUndefined(input.description);
  const footer = trimToUndefined(input.footer);
  const complete = trimToUndefined(input.complete);
  const image = trimToUndefined(input.image);

  const rawBg = trimToUndefined(input.bgcolor);
  const rawColor = trimToUndefined(input.color);

  const normalizedBg = rawBg ? normalizeColorToHex(rawBg) : undefined;
  const normalizedColor = rawColor ? normalizeColorToHex(rawColor) : undefined;
  const reducedColors = reduceColorOverrides(normalizedBg, normalizedColor);

  const params = new URLSearchParams();
  if (time) params.set("time", time);
  if (title) params.set("title", title);
  if (description) params.set("description", description);
  if (footer) params.set("footer", footer);
  if (complete && complete !== DEFAULT_COMPLETE_TEXT) {
    params.set("complete", complete);
  }
  if (image) params.set("image", image);
  if (reducedColors.bgcolor) params.set("bgcolor", reducedColors.bgcolor);
  if (reducedColors.color) params.set("color", reducedColors.color);
  return params;
};

export const canonicalizeCountdownSearchParams = (
  search: string,
): URLSearchParams => {
  const current = new URLSearchParams(search);
  const countdown = buildCanonicalCountdownSearchParams({
    time: current.get("time") || current.get("date"),
    title: current.get("title"),
    description: current.get("description"),
    footer: current.get("footer"),
    complete: current.get("complete"),
    image: current.get("image"),
    bgcolor: current.get("bgcolor"),
    color: current.get("color"),
  });

  const extras = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (COUNTDOWN_QUERY_KEYS.has(key)) continue;
    extras.append(key, value);
  }

  const merged = new URLSearchParams();
  for (const [key, value] of countdown.entries()) merged.append(key, value);
  for (const [key, value] of extras.entries()) merged.append(key, value);
  return merged;
};

export const mergeCanonicalCountdownSearchParams = (
  existingSearch: string,
  input: CountdownQueryInput,
): URLSearchParams => {
  const current = new URLSearchParams(existingSearch);
  const extras = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (COUNTDOWN_QUERY_KEYS.has(key)) continue;
    extras.append(key, value);
  }

  const countdown = buildCanonicalCountdownSearchParams(input);
  const merged = new URLSearchParams();
  for (const [key, value] of countdown.entries()) merged.append(key, value);
  for (const [key, value] of extras.entries()) merged.append(key, value);
  return merged;
};

const CANONICAL_COUNTDOWN_KEYS = [
  "time",
  "title",
  "description",
  "footer",
  "complete",
  "image",
  "bgcolor",
  "color",
] as const;

export const mergeCountdownSearchParamsWithOverrides = (
  baseSearch: string,
  overrideSearch: string,
): URLSearchParams => {
  const base = new URLSearchParams(baseSearch);
  const overrides = new URLSearchParams(overrideSearch);

  const merged = new URLSearchParams();

  for (const key of CANONICAL_COUNTDOWN_KEYS) {
    const baseValue =
      key === "time" ? base.get("time") || base.get("date") : base.get(key);
    if (baseValue != null) {
      merged.set(key, baseValue);
    }
  }

  const timeOverrideKey = overrides.has("time")
    ? "time"
    : overrides.has("date")
      ? "date"
      : null;

  if (timeOverrideKey) {
    merged.set("time", overrides.get(timeOverrideKey) ?? "");
  }

  for (const key of CANONICAL_COUNTDOWN_KEYS) {
    if (key === "time") continue;
    if (!overrides.has(key)) continue;
    merged.set(key, overrides.get(key) ?? "");
  }

  for (const [key, value] of overrides.entries()) {
    if (COUNTDOWN_QUERY_KEYS.has(key)) continue;
    merged.append(key, value);
  }

  return merged;
};

export const buildOverrideCountdownSearchParams = (
  baseSearch: string,
  input: CountdownQueryInput,
  existingSearch: string,
): URLSearchParams => {
  const base = new URLSearchParams(baseSearch);
  const current = buildCanonicalCountdownSearchParams(input);

  const overrides = new URLSearchParams();
  for (const key of CANONICAL_COUNTDOWN_KEYS) {
    const baseValue =
      key === "time" ? base.get("time") || base.get("date") : base.get(key);
    const currentValue = current.get(key);
    if (baseValue === currentValue) continue;
    if (currentValue == null) {
      overrides.set(key, "");
    } else {
      overrides.set(key, currentValue);
    }
  }

  const extras = new URLSearchParams();
  const existing = new URLSearchParams(existingSearch);
  for (const [key, value] of existing.entries()) {
    if (COUNTDOWN_QUERY_KEYS.has(key)) continue;
    extras.append(key, value);
  }

  const merged = new URLSearchParams();
  for (const [key, value] of overrides.entries()) merged.append(key, value);
  for (const [key, value] of extras.entries()) merged.append(key, value);
  return merged;
};
