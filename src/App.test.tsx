import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { resolveImage as resolveImageImpl } from "./imageResolver";

vi.mock("./imageResolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageResolver")>();
  return {
    ...actual,
    parseImageId: (value: string) => {
      const [provider, id] = value.split(":");
      if (!provider || !id) return null;
      return { provider: provider as "openverse" | "tenor", id };
    },
    resolveImage: vi.fn(),
  };
});

const resolveImageMock = vi.mocked(resolveImageImpl);

const NOW = new Date("2025-01-01T00:00:00Z");

const setSearch = (search: string) => {
  window.history.replaceState(null, "", search);
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

describe("App", () => {
  it("shows helper when no time param", () => {
    setSearch("/");
    render(<App />);

    expect(screen.getByText(/add a countdown time/i)).toBeVisible();
    expect(screen.getByLabelText(/countdown end time/i)).toHaveValue("");
    expect(screen.getByRole("main", { hidden: true })).not.toBeVisible();
    expect(
      screen.getByText("Time is up!", {
        selector: "#complete-text",
        exact: false,
      }),
    ).not.toBeVisible();
    expect(document.body.style.backgroundColor).toBe("rgb(11, 16, 33)");
    expect(document.body.style.color).toBe("rgb(242, 245, 255)");
    expect(document.title).toBe("Countdown");
  });

  it("shows validation when submitting an invalid time", async () => {
    const user = userEvent.setup();
    setSearch("/");
    render(<App />);

    await user.type(screen.getByLabelText(/countdown end time/i), "invalid");
    await user.click(screen.getByRole("button", { name: /start countdown/i }));

    const feedback = document.getElementById("time-input-feedback");
    expect(feedback).toHaveTextContent(
      "Enter a valid time in ISO UTC, e.g., 2025-01-01T00:00:00Z.",
    );
    expect(window.location.search).toBe("");
  });

  it("prefills the helper with 24h from now and clears errors", async () => {
    const user = userEvent.setup();
    vi.setSystemTime(NOW);
    setSearch("/");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /start countdown/i }));
    await user.click(
      screen.getByRole("button", { name: /set to 24h from now/i }),
    );

    const expected = new Date(
      NOW.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(screen.getByLabelText(/countdown end time/i)).toHaveValue(expected);
    expect(document.getElementById("time-input-feedback")).toHaveTextContent(
      "",
    );
  });

  it("renders the complete view when the time is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setSearch(
      "/?time=2024-12-31T23:59:59Z&complete=All%20done&image=party&description=desc&footer=foot",
    );
    mockResolvedOptions({ timeZone: "UTC" });
    render(<App />);

    expect(screen.getByText("All done")).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "party" }),
    ).not.toBeInTheDocument();
    expect(document.getElementById("time-helper")).toHaveClass("hidden");
    expect(screen.getByText("desc")).not.toBeVisible();
    expect(screen.queryByText("foot")).not.toBeInTheDocument();
    expect(document.title).toBe("All done");
  });

  it("renders countdown state with title and end date when the time is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setSearch("/?time=2025-01-02T00:00:10Z&title=Launch");
    mockResolvedOptions({ timeZone: "UTC" });
    render(<App />);

    expect(screen.getByText("Launch")).toBeVisible();
    expect(screen.getByText("Days")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("Hours")).toBeVisible();
    expect(screen.getByText("Minutes")).toBeVisible();
    expect(screen.getByText("Seconds")).toBeVisible();
    const expectedDate = new Intl.DateTimeFormat(undefined, {
      timeZone: "UTC",
      timeZoneName: "short",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date("2025-01-02T00:00:10Z"));
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(document.title).toBe("2025-01-02T00:00:10Z - 1d 00:00:10 remaining");
  });

  it("hides higher-order zero units and keeps only necessary countdown cards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    setSearch("/?time=2025-01-01T00:00:10Z&title=Quick");
    render(<App />);

    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    expect(screen.queryByText("Minutes")).not.toBeInTheDocument();
    expect(screen.getByText("Seconds")).toBeVisible();
  });

  it("updates the countdown over time and switches to complete when it expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    setSearch("/?time=2025-01-01T00:00:02Z");
    render(<App />);

    expect(screen.getByText("Seconds")).toBeVisible();
    expect(screen.getAllByText("02").length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getAllByText("01").length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    const completeContainer = document.getElementById("complete-container");
    expect(completeContainer?.style.display).toBe("");
    expect(document.title).toBe("Time is up!");
    expect(screen.queryByText("Seconds")).not.toBeVisible();
  });

  it("applies provided background and text colors to the page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setSearch("/?time=2025-01-02T00:00:10Z&bgcolor=112233&color=00ff00");
    render(<App />);

    expect(document.body).toHaveStyle({
      backgroundColor: "rgb(17, 34, 51)",
      color: "rgb(0, 255, 0)",
    });
  });

  it("renders a resolved image with attribution when using provider:id", async () => {
    resolveImageMock.mockResolvedValueOnce({
      url: "https://example.com/img.gif",
      alt: "Sticker",
      attribution: {
        text: "Powered by Tenor",
        provider: "tenor",
        href: "https://tenor.com",
      },
    });
    setSearch("/?time=2030-01-01T00:00:00Z&image=tenor:abc123");
    render(<App />);

    expect(await screen.findByRole("img", { name: "Sticker" })).toHaveAttribute(
      "src",
      "https://example.com/img.gif",
    );
    expect(screen.getByText(/tenor/i)).toBeInTheDocument();
  });

  it("caps image height based on available space to avoid scrollbars", async () => {
    resolveImageMock.mockResolvedValueOnce({
      url: "https://example.com/large.gif",
      alt: "Large",
    });
    window.innerHeight = 800;
    const rectSpy = (el: Element, rect: Partial<DOMRect>) =>
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({}),
        ...rect,
      } as DOMRect);
    const originalComputed = window.getComputedStyle;
    const computedSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((elt: Element) => {
        const style = originalComputed(elt);
        return {
          ...style,
          paddingBottom: "16px",
          getPropertyValue: style.getPropertyValue
            ? style.getPropertyValue.bind(style)
            : () => "",
        } as CSSStyleDeclaration;
      });

    setSearch(
      "/?time=2030-01-01T00:00:00Z&image=tenor:abc123&description=desc&footer=foot",
    );
    render(<App />);

    const container = document.getElementById("image-container") as HTMLElement;
    const description = document.getElementById(
      "description-container",
    ) as HTMLElement;
    const footer = document.querySelector("footer") as HTMLElement;
    rectSpy(container, { top: 100 });
    rectSpy(description, { height: 40 });
    rectSpy(footer, { height: 30 });

    // Trigger resize to recompute
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    const img = await screen.findByRole("img", { name: "Large" });
    await vi.waitFor(() => {
      expect(img.style.maxHeight).toBe("590px"); // 800 - 100 - 40 - 30 - 16 - 24 buffer
    });

    computedSpy.mockRestore();
  });
});
