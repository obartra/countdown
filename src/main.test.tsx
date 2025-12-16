import { act, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";

const setSearch = (search: string) => {
  window.history.replaceState(null, "", search);
};

const setUrl = (url: string) => {
  const parsed = new URL(url, "http://localhost");
  window.history.replaceState(null, "", `${parsed.pathname}${parsed.search}`);
};

const setupRoot = () => {
  const existing = document.getElementById("root");
  if (!existing) {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  }
};

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Root lazy editor", () => {
  it("shows the lazy editor (with fallback) when required params are missing", async () => {
    let resolveModule: ((value: unknown) => void) | undefined;
    vi.doMock("./EditPage", () => {
      return new Promise((resolve) => {
        resolveModule = resolve;
      });
    });
    setSearch("/");
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(screen.getByText(/loading editor/i)).toBeInTheDocument();
    await act(async () => {
      resolveModule?.({
        __esModule: true,
        default: () => <div data-testid="editor">Editor</div>,
      });
    });
    expect(await screen.findAllByTestId("editor")).toHaveLength(1);
  });

  it("renders the countdown when params are valid without showing the editor", async () => {
    vi.doMock("./EditPage", () => ({
      __esModule: true,
      default: () => <div data-testid="editor">Editor</div>,
    }));
    const future = "2030-01-01T00:00:00Z";
    setSearch(`/?time=${encodeURIComponent(future)}&title=Hello`);
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(screen.queryByText(/loading editor/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });

  it("forces the editor when visiting /edit even with valid params", async () => {
    vi.doMock("./EditPage", () => ({
      __esModule: true,
      default: () => <div data-testid="editor">Editor</div>,
    }));
    const future = "2030-01-01T00:00:00Z";
    setUrl(
      `http://localhost/edit?time=${encodeURIComponent(future)}&title=Hello`,
    );
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(await screen.findByTestId("editor")).toBeInTheDocument();
  });
});
