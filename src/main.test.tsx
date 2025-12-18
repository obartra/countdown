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
  it("canonicalizes the URL on initial load", async () => {
    const future = "2030-01-01T00:00:00Z";
    setSearch(
      `/?date=${encodeURIComponent(future)}&complete=${encodeURIComponent("Time is up!")}&bgcolor=fff&foo=1&foo=2`,
    );
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("time")).toBe(future);
    expect(params.has("date")).toBe(false);
    expect(params.has("complete")).toBe(false);
    expect(params.get("bgcolor")).toBe("#ffffff");
    expect(params.getAll("foo")).toEqual(["1", "2"]);
  });

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

  it("does not flash the editor while loading a published slug", async () => {
    vi.doMock("./EditPage", () => {
      throw new Error("EditPage should not load while slug is resolving");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    setUrl("http://localhost/v/example-slug");
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(
      screen.getByText(/loading published countdown/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading editor/i)).not.toBeInTheDocument();
  });

  it("applies query overrides on top of a published slug payload", async () => {
    vi.doMock("./EditPage", () => ({
      __esModule: true,
      default: () => <div data-testid="editor">Editor</div>,
    }));
    const payload = "time=2030-01-01T00:00:00Z&title=Base";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          slug: "example-slug",
          payload,
          meta: {
            slug: "example-slug",
            createdAt: Date.now(),
            timeMs: Date.parse("2030-01-01T00:00:00Z"),
            expiresAt: Date.now() + 1000,
            published: true,
            requiresPassword: false,
          },
        }),
      })) as unknown as typeof fetch,
    );

    setUrl("http://localhost/v/example-slug?title=Override");
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(await screen.findByText("Override")).toBeInTheDocument();
  });

  it("passes slug defaults into the editor while merging URL overrides", async () => {
    vi.doMock("./EditPage", () => ({
      __esModule: true,
      default: ({
        initialParams,
        publishedDefaultsSearch,
      }: {
        initialParams: { rawTime?: string; title?: string };
        publishedDefaultsSearch?: string;
      }) => (
        <div>
          <div data-testid="editor-title">{initialParams.title}</div>
          <div data-testid="editor-defaults">{publishedDefaultsSearch}</div>
        </div>
      ),
    }));

    const payload = "time=2030-01-01T00:00:00Z&title=Base";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          slug: "example-slug",
          payload,
          meta: {
            slug: "example-slug",
            createdAt: Date.now(),
            timeMs: Date.parse("2030-01-01T00:00:00Z"),
            expiresAt: Date.now() + 1000,
            published: true,
            requiresPassword: false,
          },
        }),
      })) as unknown as typeof fetch,
    );

    setUrl("http://localhost/v/example-slug/edit?title=Override");
    setupRoot();
    await act(async () => {
      await import("./main");
    });

    expect(await screen.findByTestId("editor-title")).toHaveTextContent(
      "Override",
    );
    expect(screen.getByTestId("editor-defaults")).toHaveTextContent(payload);
  });
});
