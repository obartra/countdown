import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import EditPage from "./EditPage";
import { type CountdownParams } from "./countdown";
import { resolveImage as resolveImageImpl } from "./imageResolver";
import { searchOpenverse, searchTenor } from "./imageSearch";

vi.mock("./imageSearch", () => ({
  searchOpenverse: vi.fn().mockResolvedValue({
    results: [
      {
        id: "openverse:123e4567-e89b-12d3-a456-426614174000",
        thumb: "thumb.svg",
        title: "Open",
        provider: "openverse",
      },
    ],
    nextPage: null,
  }),
  searchTenor: vi.fn().mockResolvedValue({ results: [], next: null }),
}));

vi.mock("./imageResolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageResolver")>();
  return {
    ...actual,
    resolveImage: vi.fn(),
  };
});

const resolveImageMock = vi.mocked(resolveImageImpl);

const baseParams: CountdownParams = {
  rawTime: "",
  completeText: "Time is up!",
  backgroundColor: "#0B1021",
  textColor: "#F2F5FF",
};

const mockResolvedOptions = (
  options: Partial<Intl.ResolvedDateTimeFormatOptions>,
) =>
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    locale: "en-US",
    numberingSystem: "latn",
    calendar: "gregory",
    timeZone: "UTC",
    ...options,
  } as Intl.ResolvedDateTimeFormatOptions);

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

beforeEach(() => {
  resolveImageMock.mockResolvedValue({ url: "", alt: "" });
});

describe("EditPage presets and readout", () => {
  it("shows the title in the preview pane", async () => {
    const params: CountdownParams = {
      ...baseParams,
      rawTime: "2030-01-01T00:00:00Z",
      title: "Preview title",
    };

    render(<EditPage initialParams={params} />);

    expect(await screen.findByTestId("preview-title")).toHaveTextContent(
      "Preview title",
    );
  });

  it("keeps raw user input in controls while canonicalizing the URL", () => {
    render(<EditPage initialParams={baseParams} />);

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "  Hello  " } });

    expect(titleInput.value).toBe("  Hello  ");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("title")).toBe("Hello");
  });

  it("omits default complete text from the URL even when whitespace differs", async () => {
    const params: CountdownParams = {
      ...baseParams,
      rawTime: "2000-01-01T00:00:00Z",
    };
    render(<EditPage initialParams={params} />);

    const completeInput = screen.getByLabelText(
      /complete text/i,
    ) as HTMLInputElement;
    fireEvent.change(completeInput, { target: { value: " Time is up! " } });

    expect(completeInput.value).toBe(" Time is up! ");
    expect(new URLSearchParams(window.location.search).has("complete")).toBe(
      false,
    );
    expect(await screen.findByText("Time is up!")).toBeInTheDocument();
  });

  it("applies the +30m preset and updates the time input", () => {
    const now = new Date("2025-01-01T12:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockResolvedOptions({ timeZone: "UTC" });
    render(<EditPage initialParams={baseParams} />);

    fireEvent.click(screen.getByRole("button", { name: "+30m" }));

    const expectedIso = new Date(now + 30 * 60 * 1000).toISOString();
    expect(window.location.search).toContain(encodeURIComponent(expectedIso));
  });

  it("sets the tomorrow preset to the next day at 9:00 AM local time", () => {
    const now = new Date("2025-03-15T23:30:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockResolvedOptions({ timeZone: "UTC" });
    render(<EditPage initialParams={baseParams} />);

    fireEvent.click(screen.getByRole("button", { name: /tomorrow 9:00 am/i }));

    const expectedDate = new Date(now);
    expectedDate.setDate(expectedDate.getDate() + 1);
    expectedDate.setHours(9, 0, 0, 0);
    const expectedIso = expectedDate.toISOString();
    expect(window.location.search).toContain(encodeURIComponent(expectedIso));
  });

  it("searches and selects an image, updating URL and preview", async () => {
    vi.mocked(searchOpenverse).mockResolvedValueOnce({
      results: [
        {
          id: "openverse:123e4567-e89b-12d3-a456-426614174000",
          thumb: "thumb.svg",
          title: "Open",
          provider: "openverse",
        },
      ],
      nextPage: null,
    });
    vi.mocked(searchTenor).mockResolvedValueOnce({ results: [], next: null });
    resolveImageMock.mockResolvedValue({
      url: "https://example.com/image.svg",
      alt: "Open image",
    });
    render(<EditPage initialParams={baseParams} />);

    fireEvent.change(screen.getByPlaceholderText(/search stickers or svgs/i), {
      target: { value: "cat" },
    });

    const result = await screen.findByTestId(
      "image-result-openverse:123e4567-e89b-12d3-a456-426614174000",
    );
    fireEvent.click(result);

    expect(window.location.search).toContain(
      "image=openverse%3A123e4567-e89b-12d3-a456-426614174000",
    );
    await screen.findByText(/Selected image/i);
  });

  it("loads more results when View more is clicked", async () => {
    vi.mocked(searchOpenverse)
      .mockResolvedValueOnce({
        results: [
          {
            id: "openverse:page1",
            thumb: "thumb1.svg",
            title: "Page 1",
            provider: "openverse",
          },
        ],
        nextPage: 2,
      })
      .mockResolvedValueOnce({
        results: [
          {
            id: "openverse:page2",
            thumb: "thumb2.svg",
            title: "Page 2",
            provider: "openverse",
          },
        ],
        nextPage: null,
      });
    vi.mocked(searchTenor).mockResolvedValue({ results: [], next: null });
    resolveImageMock.mockResolvedValue({
      url: "https://example.com/image.svg",
      alt: "img",
    });

    render(<EditPage initialParams={baseParams} />);

    fireEvent.change(screen.getByPlaceholderText(/search stickers or svgs/i), {
      target: { value: "cat" },
    });

    expect(await screen.findByText("Page 1")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /view more/i }));

    expect(await screen.findByText("Page 2")).toBeInTheDocument();
  });

  it("shows custom colors when they don't match a theme and clears custom after selecting a theme", () => {
    const params: CountdownParams = {
      rawTime: "",
      completeText: "Time is up!",
      backgroundColor: "#123456",
      textColor: "#abcdef",
      backgroundColorInput: "#123456",
      textColorInput: "#abcdef",
      isCustomTheme: true,
    };

    render(<EditPage initialParams={params} />);

    expect(screen.getByTestId("theme-custom")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-midnight"));

    expect(screen.queryByTestId("theme-custom")).not.toBeInTheDocument();
    expect(window.location.search).not.toContain("bgcolor=");
    expect(window.location.search).not.toContain("color=");
  });

  it("shows the report link in the preview for parity (no-op)", async () => {
    const params: CountdownParams = {
      ...baseParams,
      rawTime: "2030-01-01T00:00:00Z",
    };

    render(<EditPage initialParams={params} />);

    const reportButton = await screen.findByRole("button", {
      name: /report this countdown/i,
    });
    fireEvent.click(reportButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gates password-protected published slugs behind the owner access screen", async () => {
    const params: CountdownParams = {
      ...baseParams,
      rawTime: "2030-01-01T00:00:00Z",
      title: "Locked title",
    };

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return {
            ok: true,
            text: async () => JSON.stringify({ deleted: true }),
          };
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ verified: true }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(
      <EditPage
        initialParams={params}
        publishedContext={{
          slug: "protected-slug",
          expiresAt: Date.now() + 1000,
          requiresPassword: true,
        }}
        publishedDefaultsSearch="time=2030-01-01T00:00:00Z&title=Locked%20title"
      />,
    );

    expect(screen.getByText(/owner access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug (optional)")).toHaveValue(
      "protected-slug",
    );

    const deleteButton = screen.getByRole("button", {
      name: /delete published slug/i,
    });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type slug to confirm/i), {
      target: { value: "protected-slug" },
    });

    expect(deleteButton).not.toBeDisabled();
    fireEvent.click(deleteButton);

    const deleteCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        typeof input === "string" &&
        input.includes("/api/published/protected-slug") &&
        init?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
    const deleteInit = deleteCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(deleteInit?.body as string)).toEqual({
      password: "secret",
    });
  });

  it("treats published slugs as secondary defaults and writes only overrides into the URL", async () => {
    const params: CountdownParams = {
      ...baseParams,
      rawTime: "2030-01-01T00:00:00Z",
      title: "Base title",
    };

    render(
      <EditPage
        initialParams={params}
        publishedContext={{ slug: "tester", requiresPassword: false }}
        publishedDefaultsSearch="time=2030-01-01T00:00:00Z&title=Base%20title"
      />,
    );

    expect(new URLSearchParams(window.location.search).has("time")).toBe(false);
    expect(new URLSearchParams(window.location.search).has("title")).toBe(
      false,
    );

    const titleInput = await screen.findByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Override title" } });

    const afterOverride = new URLSearchParams(window.location.search);
    expect(afterOverride.get("title")).toBe("Override title");
    expect(afterOverride.has("time")).toBe(false);

    fireEvent.change(titleInput, { target: { value: "" } });

    const afterClear = new URLSearchParams(window.location.search);
    expect(afterClear.has("title")).toBe(true);
    expect(afterClear.get("title")).toBe("");
    expect(afterClear.has("time")).toBe(false);
  });
});
