import { DEFAULT_THEME_KEY, themeMap, themes } from "./themes";

export type CountdownState = "helper" | "countdown" | "complete";

export type CountdownDisplay = {
  label: string;
  totalMs: number;
  parts: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
};

export type CountdownParams = {
  rawTime: string;
  title?: string;
  description?: string;
  footer?: string;
  image?: string;
  completeText: string;
  backgroundColor: string;
  textColor: string;
  backgroundColorInput?: string;
  textColorInput?: string;
  themeKey?: string;
  isCustomTheme?: boolean;
};

const formatColorName = (colorName: string | null): string | undefined => {
  if (!colorName) return undefined;
  const value = colorName.trim();
  if (!value) return undefined;

  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

const getRGBFromColorName = (colorName: string): [number, number, number] => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext("2d");
  if (!ctx) return [0, 0, 0];

  ctx.fillStyle = colorName;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
};

const contrastColor = ([r, g, b]: [number, number, number]) => {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "black" : "white";
};

const rgbToHex = ([r, g, b]: [number, number, number]) =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;

const normalizeToHex = (color: string | null) => {
  if (!color) return null;
  const [r, g, b] = getRGBFromColorName(color);
  return rgbToHex([r, g, b]).toLowerCase();
};

const defaultTheme = themeMap.get(DEFAULT_THEME_KEY) ?? themes[0];

export type DerivedColors = {
  backgroundColor: string;
  textColor: string;
  themeKey?: string;
  isCustomTheme: boolean;
};

export const deriveColors = (
  backgroundRaw: string | null,
  textRaw: string | null,
): DerivedColors => {
  let backgroundColor = formatColorName(backgroundRaw);
  let textColor = formatColorName(textRaw);

  if (!backgroundColor && !textColor) {
    backgroundColor = defaultTheme.background;
    textColor = defaultTheme.text;
  }

  if (backgroundColor && !textColor) {
    textColor = contrastColor(getRGBFromColorName(backgroundColor));
  } else if (!backgroundColor && textColor) {
    backgroundColor = contrastColor(getRGBFromColorName(textColor));
  }

  if (!backgroundColor) backgroundColor = defaultTheme.background;
  if (!textColor) textColor = defaultTheme.text;

  const normalizedBg = normalizeToHex(backgroundColor);
  const normalizedText = normalizeToHex(textColor);

  let themeKey: string | null = null;
  if (normalizedBg && normalizedText) {
    const match = themes.find((theme) => {
      const themeBg = normalizeToHex(theme.background);
      const themeText = normalizeToHex(theme.text);
      return themeBg === normalizedBg && themeText === normalizedText;
    });
    themeKey = match?.key ?? null;
  }

  return {
    backgroundColor,
    textColor,
    themeKey: themeKey ?? undefined,
    isCustomTheme: !themeKey,
  };
};

export const formatCountdown = (msRemaining: number): CountdownDisplay => {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const totalDays = Math.floor(totalSeconds / 86400);
  const days = totalDays;

  const labelParts: string[] = [];
  labelParts.push(`${days}d`);
  labelParts.push(
    `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
  );

  return {
    label: labelParts.join(" "),
    totalMs: msRemaining,
    parts: {
      days,
      hours,
      minutes,
      seconds,
    },
  };
};

export const parseParamsFromSearch = (search: string): CountdownParams => {
  const params = new URLSearchParams(search);
  const timeParam = params.get("time");
  const dateAlias = params.get("date");
  const rawTime = timeParam || dateAlias || "";
  const bgcolor = params.get("bgcolor");
  const color = params.get("color");
  const colors = deriveColors(bgcolor, color);

  return {
    rawTime,
    title: params.get("title") || undefined,
    description: params.get("description") || undefined,
    footer: params.get("footer") || undefined,
    image: params.get("image") || undefined,
    completeText: params.get("complete") || "Time is up!",
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    backgroundColorInput: bgcolor || "",
    textColorInput: color || "",
    themeKey: colors.themeKey,
    isCustomTheme: colors.isCustomTheme,
  };
};

export const dateFormatter = (date: Date) => {
  const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;

  return date.toLocaleDateString(userLocale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const deriveCountdownMeta = (
  params: CountdownParams,
  now: number = Date.now(),
) => {
  const trimmedTime = params.rawTime.trim();
  const parsedTime = trimmedTime ? Date.parse(trimmedTime) : NaN;
  const hasValidTime = !Number.isNaN(parsedTime);
  const targetDate = hasValidTime ? new Date(parsedTime) : null;
  const state: CountdownState = !hasValidTime
    ? "helper"
    : parsedTime <= now
      ? "complete"
      : "countdown";

  return { trimmedTime, parsedTime, targetDate, hasValidTime, state };
};
