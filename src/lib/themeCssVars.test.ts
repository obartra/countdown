import { describe, expect, it } from "vitest";
import {
  createThemeCssVars,
  hexToHslChannels,
  resolveThemeTokens,
} from "./themeCssVars";
import { DEFAULT_THEME_KEY, themeMap } from "../themes";

const hexToRgb = (hex: string) => {
  const cleaned = hex.trim().replace(/^#/, "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => char + char)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
};

const srgbToLinear = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastRatio = (a: string, b: string) => {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const [lighter, darker] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
};

describe("themeCssVars", () => {
  it("converts hex to HSL channels", () => {
    expect(hexToHslChannels("#000000")).toBe("0 0% 0%");
    expect(hexToHslChannels("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslChannels("#ff0000")).toBe("0 100% 50%");
  });

  it("uses catalog tokens when themeKey is provided", () => {
    const defaultTheme = themeMap.get(DEFAULT_THEME_KEY);
    expect(defaultTheme).toBeTruthy();

    const resolved = resolveThemeTokens({
      backgroundColor: "#000000",
      textColor: "#ffffff",
      themeKey: DEFAULT_THEME_KEY,
    });

    expect(resolved.surface).toBe(defaultTheme!.surface);
    expect(resolved.textSecondary).toBe(defaultTheme!.textSecondary);
  });

  it("derives AA-readable surface + secondary text for custom colors", () => {
    const tokens = resolveThemeTokens({
      backgroundColor: "#0B1021",
      textColor: "#F2F5FF",
    });

    const MIN_AA = 4.5;
    expect(
      contrastRatio(tokens.text, tokens.background),
    ).toBeGreaterThanOrEqual(MIN_AA);
    expect(
      contrastRatio(tokens.textSecondary, tokens.background),
    ).toBeGreaterThanOrEqual(MIN_AA);
    expect(contrastRatio(tokens.text, tokens.surface)).toBeGreaterThanOrEqual(
      MIN_AA,
    );
    expect(
      contrastRatio(tokens.textSecondary, tokens.surface),
    ).toBeGreaterThanOrEqual(MIN_AA);
  });

  it("builds CSS variables that match the token colors", () => {
    const defaultTheme = themeMap.get(DEFAULT_THEME_KEY)!;
    const vars = createThemeCssVars(defaultTheme);

    expect(vars["--background"]).toBe(
      hexToHslChannels(defaultTheme.background),
    );
    expect(vars["--card"]).toBe(hexToHslChannels(defaultTheme.surface));
    expect(vars["--muted-foreground"]).toBe(
      hexToHslChannels(defaultTheme.textSecondary),
    );
  });
});
