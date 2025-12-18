import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
