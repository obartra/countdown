import { themeMap, type ThemeDefinition } from "../themes";

export type ThemeTokens = Pick<
  ThemeDefinition,
  "background" | "surface" | "text" | "textSecondary" | "accent"
>;

type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb | null => {
  const cleaned = hex.trim().replace(/^#/, "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => char + char)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
};

const parseNamedColor = (color: string): Rgb | null => {
  const normalized = color.trim().toLowerCase();
  if (normalized === "black") return { r: 0, g: 0, b: 0 };
  if (normalized === "white") return { r: 255, g: 255, b: 255 };
  return null;
};

const parseColor = (color: string): Rgb | null =>
  parseHex(color) ?? parseNamedColor(color);

const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r * (1 - t) + b.r * t),
  g: Math.round(a.g * (1 - t) + b.g * t),
  b: Math.round(a.b * (1 - t) + b.b * t),
});

const srgbToLinear = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (rgb: Rgb) => {
  const R = srgbToLinear(rgb.r);
  const G = srgbToLinear(rgb.g);
  const B = srgbToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastRatio = (a: Rgb, b: Rgb) => {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const [lighter, darker] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
};

const rgbToHsl = (rgb: Rgb) => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export const hexToHslChannels = (hex: string): string => {
  const rgb = parseHex(hex);
  if (!rgb) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const hsl = rgbToHsl(rgb);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
};

const colorToHslChannels = (color: string): string | null => {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
};

const pickReadableText = (background: Rgb): string => {
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const black: Rgb = { r: 0, g: 0, b: 0 };
  return contrastRatio(white, background) >= contrastRatio(black, background)
    ? "#ffffff"
    : "#000000";
};

const findMaxBlendFactor = (
  start: Rgb,
  end: Rgb,
  predicate: (candidate: Rgb) => boolean,
) => {
  let low = 0;
  let high = 1;
  let best = 0;
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    const candidate = mixRgb(start, end, mid);
    if (predicate(candidate)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
};

const deriveCustomSurface = (background: Rgb, text: Rgb): Rgb => {
  const MIN_AA = 4.5;
  const target = 0.12;

  const baseline = contrastRatio(text, background);
  if (baseline < MIN_AA) return background;

  const maxAllowed = findMaxBlendFactor(background, text, (candidate) => {
    return contrastRatio(text, candidate) >= MIN_AA;
  });
  const factor = Math.min(target, maxAllowed);
  return mixRgb(background, text, factor);
};

const deriveCustomSecondaryText = (
  text: Rgb,
  background: Rgb,
  surface: Rgb,
): Rgb => {
  const MIN_AA = 4.5;

  const baseline = Math.min(
    contrastRatio(text, background),
    contrastRatio(text, surface),
  );
  if (baseline < MIN_AA) return text;

  const maxAllowed = findMaxBlendFactor(text, background, (candidate) => {
    return (
      contrastRatio(candidate, background) >= MIN_AA &&
      contrastRatio(candidate, surface) >= MIN_AA
    );
  });
  const factor = Math.min(0.45, maxAllowed);
  return mixRgb(text, background, factor);
};

export const resolveThemeTokens = (input: {
  backgroundColor: string;
  textColor: string;
  themeKey?: string;
}): ThemeTokens => {
  const theme = input.themeKey ? themeMap.get(input.themeKey) : undefined;
  if (theme) return theme;

  const backgroundRgb = parseColor(input.backgroundColor);
  const textRgb = parseColor(input.textColor);
  if (!backgroundRgb || !textRgb) {
    const fallbackTheme = themeMap.get("midnight");
    if (fallbackTheme) return fallbackTheme;
    return themeMap.values().next().value as ThemeDefinition;
  }

  const surfaceRgb = deriveCustomSurface(backgroundRgb, textRgb);
  const secondaryRgb = deriveCustomSecondaryText(
    textRgb,
    backgroundRgb,
    surfaceRgb,
  );

  const primary = input.textColor;

  return {
    background: input.backgroundColor,
    surface: rgbToHex(surfaceRgb),
    text: input.textColor,
    textSecondary: rgbToHex(secondaryRgb),
    accent: primary,
  };
};

export const createThemeCssVars = (
  tokens: ThemeTokens,
): Record<`--${string}`, string> => {
  const background = colorToHslChannels(tokens.background);
  const foreground = colorToHslChannels(tokens.text);
  const card = colorToHslChannels(tokens.surface);
  const mutedForeground = colorToHslChannels(tokens.textSecondary);

  const primary = colorToHslChannels(tokens.accent ?? tokens.text);
  const primaryRgb = parseColor(tokens.accent ?? tokens.text);
  const primaryForegroundRgb = primaryRgb
    ? parseColor(pickReadableText(primaryRgb))!
    : { r: 255, g: 255, b: 255 };
  const primaryForegroundHsl = rgbToHsl(primaryForegroundRgb);
  const primaryForeground = `${primaryForegroundHsl.h} ${primaryForegroundHsl.s}% ${primaryForegroundHsl.l}%`;

  const backgroundRgb = parseColor(tokens.background);
  const secondaryRgb = parseColor(tokens.textSecondary);
  const surfaceRgb = parseColor(tokens.surface);
  const borderHex =
    backgroundRgb && secondaryRgb && surfaceRgb
      ? rgbToHex(mixRgb(surfaceRgb, secondaryRgb, 0.25))
      : null;
  const border = borderHex ? colorToHslChannels(borderHex) : null;

  const vars: Record<`--${string}`, string> = {};
  if (background) vars["--background"] = background;
  if (foreground) vars["--foreground"] = foreground;
  if (card) {
    vars["--card"] = card;
    vars["--card-foreground"] = foreground ?? card;
    vars["--muted"] = card;
    vars["--popover"] = card;
    vars["--secondary"] = card;
  }
  if (foreground) {
    vars["--popover-foreground"] = foreground;
    vars["--secondary-foreground"] = foreground;
  }
  if (mutedForeground) vars["--muted-foreground"] = mutedForeground;
  if (primary) {
    vars["--primary"] = primary;
    vars["--accent"] = primary;
    vars["--ring"] = primary;
  }
  if (primaryForeground) {
    vars["--primary-foreground"] = primaryForeground;
    vars["--accent-foreground"] = primaryForeground;
  }
  if (border) {
    vars["--border"] = border;
    vars["--input"] = border;
  }

  return vars;
};
