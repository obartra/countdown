import { describe, expect, it } from "vitest";
import { themes } from "./themes";

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

describe("themes", () => {
  it("ensures AA contrast for primary + secondary text on background + surface", () => {
    const MIN_AA = 4.5;

    for (const theme of themes) {
      expect(
        contrastRatio(theme.text, theme.background),
        `${theme.key} text on background`,
      ).toBeGreaterThanOrEqual(MIN_AA);
      expect(
        contrastRatio(theme.textSecondary, theme.background),
        `${theme.key} secondary text on background`,
      ).toBeGreaterThanOrEqual(MIN_AA);
      expect(
        contrastRatio(theme.text, theme.surface),
        `${theme.key} text on surface`,
      ).toBeGreaterThanOrEqual(MIN_AA);
      expect(
        contrastRatio(theme.textSecondary, theme.surface),
        `${theme.key} secondary text on surface`,
      ).toBeGreaterThanOrEqual(MIN_AA);
    }
  });
});
