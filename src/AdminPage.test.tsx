import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import AdminPage from "./AdminPage";

const mockStats = {
  totalActive: 2,
  anonymousActive: 1,
  passwordProtectedActive: 1,
  publishes: {
    last24Hours: 3,
    last7Days: 4,
    last30Days: 5,
  },
  rateLimitHitsLast24Hours: 0,
  failedDeleteAttemptsLast24Hours: 1,
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prompts for admin secret when none is set", () => {
    render(<AdminPage />);
    expect(screen.getByText(/admin access/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admin secret/i)).toBeInTheDocument();
  });

  it("loads stats after entering the secret", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => mockStats,
    } as unknown as Response);

    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText(/admin secret/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByText(/reports & published/i)).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/stats/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(mockStats.totalActive.toString()),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/admin-stats", {
      headers: { "x-admin-secret": "secret" },
    });
  });

  it("respects an existing secret in sessionStorage", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => mockStats,
    } as unknown as Response);

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText(/reports & published/i)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it("clears the secret from the settings card", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => mockStats,
    } as unknown as Response);

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText(/reports & published/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /clear secret/i }));
    expect(window.sessionStorage.getItem("adminSecret")).toBeNull();
    // Stats fetch should not refire after clearing unless re-entered, so just ensure no crash
    expect(fetchMock).toHaveBeenCalled();
  });

  it("opens stats JSON in a new tab using the stored secret", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => mockStats,
    } as unknown as Response);
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => "blob:mock");
    const revokeObjectURLMock = vi.fn();
    (
      URL as unknown as { createObjectURL: typeof createObjectURLMock }
    ).createObjectURL = createObjectURLMock;
    (
      URL as unknown as { revokeObjectURL: typeof revokeObjectURLMock }
    ).revokeObjectURL = revokeObjectURLMock;

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText(/reports & published/i)).toBeInTheDocument(),
    );
    fetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /view json/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalled();

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    openSpy.mockRestore();
  });

  it("shows an error when stats JSON cannot be loaded", async () => {
    window.sessionStorage.setItem("adminSecret", "secret");
    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 2) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => mockStats,
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 401,
        text: async () => "",
        json: async () => ({}),
      } as unknown as Response;
    });

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText(/reports & published/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /view json/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid admin secret/i)).toBeInTheDocument(),
    );
  });
});
