import React, { useEffect, useState, useCallback } from "react";

type ReportItem = {
  slug: string;
  reportCount: number;
  lastReportedAt: string;
  lastReason: string;
  reviewed: boolean;
};

type ReportsResponse = {
  items: ReportItem[];
  nextCursor: string | null;
  total: number;
};

type FetchState = {
  loading: boolean;
  error: string | null;
};

const API_BASE = "/api/admin/reports";
const PUBLISHED_API_BASE = "/api/published";

const formatDateTime = (iso: string) => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Unknown";
  return new Date(ms).toLocaleString();
};

const parseDatetimeLocal = (value: string) => {
  if (!value) return "";
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString();
};

const AdminReportsPage: React.FC = () => {
  const [secretInput, setSecretInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("adminSecret") ?? "";
  });
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("adminSecret") ?? "";
  });

  const [items, setItems] = useState<ReportItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sinceInput, setSinceInput] = useState<string>("");
  const [hideReviewed, setHideReviewed] = useState<boolean>(false);
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: null,
  });
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "clear";
    slug: string;
  } | null>(null);

  const hasSecret = secret.trim().length > 0;

  const loadReports = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (!hasSecret) return;
      setFetchState({ loading: true, error: null });
      try {
        const params = new URLSearchParams();
        if (reset) {
          if (sinceInput) {
            const iso = parseDatetimeLocal(sinceInput);
            if (iso) params.set("since", iso);
          }
          if (hideReviewed) params.set("reviewed", "false");
        } else if (hideReviewed) {
          params.set("reviewed", "false");
        }
        params.set("limit", "50");
        if (!reset && nextCursor) params.set("cursor", nextCursor);
        const response = await fetch(`${API_BASE}?${params.toString()}`, {
          method: "GET",
          headers: { "x-admin-secret": secret },
        });
        if (response.status === 401) {
          setFetchState({
            loading: false,
            error: "Invalid admin secret",
          });
          return;
        }
        if (!response.ok) {
          setFetchState({
            loading: false,
            error: `Failed to load reports (${response.status})`,
          });
          return;
        }
        const data = (await response.json()) as ReportsResponse;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor);
        setFetchState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setFetchState({
          loading: false,
          error: "Unexpected error loading reports",
        });
      }
    },
    [hasSecret, hideReviewed, nextCursor, secret, sinceInput],
  );

  useEffect(() => {
    if (!hasSecret) return;
    loadReports({ reset: true }).catch(() => {});
  }, [hasSecret, loadReports]);

  const handleSubmitSecret = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = secretInput.trim();
    setSecret(trimmed);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("adminSecret", trimmed);
    }
  };

  const markReviewed = async (slug: string) => {
    const prevItems = items;
    setItems((current) =>
      current.map((item) =>
        item.slug === slug ? { ...item, reviewed: true } : item,
      ),
    );

    try {
      const response = await fetch(`${API_BASE}/${slug}`, {
        method: "PATCH",
        headers: {
          "x-admin-secret": secret,
        },
      });
      if (!response.ok) {
        setItems(prevItems);
        setFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to mark reviewed",
        });
      }
    } catch (error) {
      console.error(error);
      setItems(prevItems);
      setFetchState({
        loading: false,
        error: "Failed to mark reviewed",
      });
    }
  };

  // Optimistic-only updates; assumes single-admin usage. Revisit with multi-admin to refetch server state.
  const performDelete = async (slug: string) => {
    const prevItems = items;
    setFetchState({ loading: true, error: null });
    try {
      const response = await fetch(`${PUBLISHED_API_BASE}/${slug}`, {
        method: "DELETE",
        headers: { "x-admin-override": secret },
      });
      if (!response.ok) {
        setFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to delete countdown",
        });
        return;
      }
      setItems((current) => current.filter((item) => item.slug !== slug));
      setFetchState({ loading: false, error: null });
    } catch (error) {
      console.error(error);
      setItems(prevItems);
      setFetchState({
        loading: false,
        error: "Failed to delete countdown",
      });
    }
  };

  // Optimistic-only updates; assumes single-admin usage. Revisit with multi-admin to refetch server state.
  const performClear = async (slug: string) => {
    const prevItems = items;
    setFetchState({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/${slug}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      if (!response.ok) {
        setFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to clear reports",
        });
        return;
      }
      const nowIso = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.slug === slug
            ? {
                ...item,
                reportCount: 0,
                lastReason: "",
                reviewed: true,
                lastReportedAt: nowIso,
              }
            : item,
        ),
      );
      setFetchState({ loading: false, error: null });
    } catch (error) {
      console.error(error);
      setItems(prevItems);
      setFetchState({
        loading: false,
        error: "Failed to clear reports",
      });
    }
  };

  const secretForm = (
    <form
      onSubmit={handleSubmitSecret}
      className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admin Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the admin secret to view reported slugs.
        </p>
      </div>
      <label className="block text-sm font-medium text-foreground">
        Admin secret
        <input
          type="password"
          value={secretInput}
          onChange={(event) => setSecretInput(event.target.value)}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="current-password"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Continue
      </button>
    </form>
  );

  if (!hasSecret) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        {secretForm}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Reports</h1>
            <p className="text-sm text-muted-foreground">
              Review reported slugs. Filter and mark items as reviewed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSecret("");
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem("adminSecret");
              }
            }}
            className="text-sm text-muted-foreground underline"
          >
            Change secret
          </button>
        </div>

        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase text-muted-foreground">
              Since
            </span>
            <input
              type="datetime-local"
              value={sinceInput}
              onChange={(event) => setSinceInput(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideReviewed}
              onChange={(event) => setHideReviewed(event.target.checked)}
            />
            <span className="text-sm text-foreground">Hide reviewed</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadReports({ reset: true })}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              disabled={fetchState.loading}
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                setSinceInput("");
                setHideReviewed(false);
                loadReports({ reset: true });
              }}
              className="rounded-md border border-border px-3 py-2 text-sm"
              disabled={fetchState.loading}
            >
              Reset
            </button>
          </div>
        </div>

        {fetchState.error ? (
          <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {fetchState.error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[2fr,1fr,2fr,1fr,1fr,1.2fr] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>Slug</span>
            <span>Reports</span>
            <span>Last reason</span>
            <span>Last reported</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {fetchState.loading ? "Loading reports..." : "No reports found."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div
                  key={item.slug}
                  className="grid grid-cols-[2fr,1fr,2fr,1fr,1fr,1.2fr] items-start gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex flex-col gap-1">
                    <a
                      href={`/v/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {item.slug}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {item.reviewed ? "Reviewed" : "Unreviewed"}
                    </span>
                  </div>
                  <span>{item.reportCount}</span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {item.lastReason || "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(item.lastReportedAt)}
                  </span>
                  <div className="flex flex-col items-start gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        item.reviewed
                          ? "bg-emerald-900/40 text-emerald-100"
                          : "bg-amber-900/40 text-amber-100"
                      }`}
                    >
                      {item.reviewed ? "Reviewed" : "Needs review"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!item.reviewed ? (
                      <button
                        type="button"
                        onClick={() => markReviewed(item.slug)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        disabled={fetchState.loading}
                      >
                        Mark reviewed
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() =>
                        setConfirmAction({ type: "clear", slug: item.slug })
                      }
                      disabled={fetchState.loading}
                    >
                      Clear reports
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:opacity-90"
                      onClick={() =>
                        setConfirmAction({ type: "delete", slug: item.slug })
                      }
                      disabled={fetchState.loading}
                    >
                      Delete countdown
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {nextCursor ? (
            <button
              type="button"
              onClick={() => loadReports({ reset: false })}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              disabled={fetchState.loading}
            >
              {fetchState.loading ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">
              {confirmAction.type === "delete"
                ? "Delete countdown"
                : "Clear reports"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirmAction.type === "delete"
                ? "This will permanently delete the countdown and its published data. This cannot be undone."
                : "This will reset report metadata for the slug. Raw report blobs will remain for audit."}
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Slug: {confirmAction.slug}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => setConfirmAction(null)}
                disabled={fetchState.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  confirmAction.type === "delete"
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
                onClick={() => {
                  if (confirmAction.type === "delete") {
                    performDelete(confirmAction.slug);
                  } else {
                    performClear(confirmAction.slug);
                  }
                  setConfirmAction(null);
                }}
                disabled={fetchState.loading}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminReportsPage;
export { formatDateTime, parseDatetimeLocal };
