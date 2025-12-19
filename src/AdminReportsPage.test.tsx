import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import AdminReportsPage from "./AdminReportsPage";

const mockReportsResponse = {
  items: [
    {
      slug: "test-slug",
      reportCount: 2,
      lastReportedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
      lastReason: "Inappropriate",
      reviewed: false,
    },
  ],
  nextCursor: null,
  total: 1,
};

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prompts for secret when none is stored", () => {
    render(<AdminReportsPage />);
    expect(screen.getByText(/enter the admin secret/i)).toBeInTheDocument();
  });

  it("loads reports when secret is present", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReportsResponse,
    } as unknown as Response);

    render(<AdminReportsPage />);

    await waitFor(() =>
      expect(screen.getByText("test-slug")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalled();
    const url = (fetchMock.mock.calls[0][0] as string) ?? "";
    expect(url.startsWith("/api/admin/reports")).toBe(true);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { "x-admin-secret": "secret" },
    });
  });

  it("applies hide reviewed filter", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReportsResponse,
    } as unknown as Response);

    render(<AdminReportsPage />);
    await waitFor(() =>
      expect(screen.getByText("test-slug")).toBeInTheDocument(),
    );
    fetchMock.mockClear();

    fireEvent.click(screen.getByLabelText(/hide reviewed/i));
    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("reviewed=false");
  });

  it("loads published view on toggle and hits the correct endpoint", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const publishedSlug = "published-slug";
    const mockPublishedResponse = {
      items: [
        {
          slug: publishedSlug,
          createdAt: 1,
          timeMs: 1000,
          expiresAt: null,
          published: true,
          requiresPassword: false,
        },
      ],
      nextCursor: null,
      total: 1,
    };

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (resource) => {
        const url =
          typeof resource === "string"
            ? resource
            : ((resource as { url?: string }).url ?? "");
        if (url.startsWith("/api/admin/reports")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockReportsResponse,
          } as unknown as Response;
        }
        if (url.startsWith("/api/admin/published")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockPublishedResponse,
          } as unknown as Response;
        }
        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<AdminReportsPage />);

    await waitFor(() =>
      expect(screen.getByText("test-slug")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /published slugs/i }));

    await waitFor(() =>
      expect(screen.getByText(publishedSlug)).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/published"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("clears reports when confirming the action", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (resource, init) => {
        const url =
          typeof resource === "string"
            ? resource
            : ((resource as { url?: string }).url ?? "");
        if (url.startsWith("/api/admin/reports")) {
          if (init?.method === "DELETE") {
            return { ok: true, status: 200 } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => mockReportsResponse,
          } as unknown as Response;
        }
        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<AdminReportsPage />);

    await waitFor(() =>
      expect(screen.getByText("test-slug")).toBeInTheDocument(),
    );
    const reportRow = screen
      .getByText("test-slug")
      .closest("div.grid") as HTMLElement;
    expect(within(reportRow).getByText(/needs review/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear reports/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(
        within(reportRow).queryByText(/needs review/i),
      ).not.toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/reports/test-slug"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
