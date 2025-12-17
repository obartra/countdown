import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
  document.title = "";
});

const mockCanvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  getImageData: vi.fn(),
} as unknown as CanvasRenderingContext2D;

const normalizeHex = (hex: string) => {
  const value = hex.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`;
  if (/^[0-9a-f]{3}$/.test(value)) {
    return `#${value
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return null;
};

const parseRgbFunction = (value: string) => {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts.length >= 4 ? Math.round(Number(parts[3]) * 255) : 255;
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
    Math.max(0, Math.min(255, a)),
  ] as const;
};

const NAMED_COLORS: Record<string, readonly [number, number, number, number]> =
  {
    black: [0, 0, 0, 255],
    white: [255, 255, 255, 255],
    transparent: [0, 0, 0, 0],
  };

let currentFillStyle = "#000000";
Object.defineProperty(mockCanvasContext, "fillStyle", {
  get: () => currentFillStyle,
  set: (value: unknown) => {
    const stringValue = String(value).trim();
    const normalizedHex = normalizeHex(stringValue);
    if (normalizedHex) {
      currentFillStyle = normalizedHex;
      return;
    }

    const rgb = parseRgbFunction(stringValue);
    if (rgb) {
      currentFillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${rgb[3] / 255})`;
      return;
    }

    const named = NAMED_COLORS[stringValue.toLowerCase()];
    if (named) {
      currentFillStyle = stringValue.toLowerCase();
    }
  },
});

const buildMockImageData = (data: Uint8ClampedArray) =>
  ({
    data,
    width: 1,
    height: 1,
    colorSpace: "srgb",
  }) as ImageData;

mockCanvasContext.getImageData = vi.fn(() => {
  const hex = normalizeHex(currentFillStyle);
  if (hex) {
    const value = hex.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return buildMockImageData(new Uint8ClampedArray([r, g, b, 255]));
  }

  const rgb = parseRgbFunction(currentFillStyle);
  if (rgb) {
    return buildMockImageData(new Uint8ClampedArray(rgb));
  }

  const named = NAMED_COLORS[currentFillStyle.toLowerCase()] ?? [0, 0, 0, 255];
  return buildMockImageData(new Uint8ClampedArray(named));
});

HTMLCanvasElement.prototype.getContext = vi.fn(
  () => mockCanvasContext,
) as unknown as HTMLCanvasElement["getContext"];

class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
