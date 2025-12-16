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
  fillStyle: "",
  fillRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
} as unknown as CanvasRenderingContext2D;

HTMLCanvasElement.prototype.getContext = vi.fn(
  () => mockCanvasContext,
) as unknown as HTMLCanvasElement["getContext"];
