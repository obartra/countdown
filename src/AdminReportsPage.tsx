import React, { useCallback, useEffect, useMemo, useState } from "react";

type AdminView = "reports" | "published";

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

type PublishedItem = {
  slug: string;
  createdAt: number;
  timeMs: number;
  expiresAt: number | null | undefined;
  published: boolean;
  requiresPassword: boolean;
};

type PublishedResponse = {
  items: PublishedItem[];
  nextCursor: string | null;
  total: number;
};

type FetchState = {
  loading: boolean;
  error: string | null;
};

const API_BASE = "/api/admin/reports";
const PUBLISHED_API_BASE = "/api/admin/published";

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

const formatTimestamp = (value?: number | null) =>
  value !== undefined && value !== null
    ? formatDateTime(new Date(value).toISOString())
    : "—";

const AdminReportsPage: React.FC = () => {
  const [secretInput, setSecretInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("adminSecret") ?? "";
  });
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("adminSecret") ?? "";
  });
  const [view, setView] = useState<AdminView>("reports");

  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([]);
  const [reportNextCursor, setReportNextCursor] = useState<string | null>(null);
  const [publishedNextCursor, setPublishedNextCursor] = useState<string | null>(
    null,
  );
  const [reportTotal, setReportTotal] = useState(0);
  const [publishedTotal, setPublishedTotal] = useState(0);
  const [sinceInput, setSinceInput] = useState("");
  const [hideReviewed, setHideReviewed] = useState(false);
  const [reportFetchState, setReportFetchState] = useState<FetchState>({
    loading: false,
    error: null,
  });
  const [publishedFetchState, setPublishedFetchState] = useState<FetchState>({
    loading: false,
    error: null,
  });
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "clear";
    slug: string;
    view: AdminView;
  } | null>(null);

  const hasSecret = secret.trim().length > 0;

  const updateFetchStateForView = (
    targetView: AdminView,
    state: FetchState,
  ) => {
    if (targetView === "reports") {
      setReportFetchState(state);
    } else {
      setPublishedFetchState(state);
    }
  };

  const loadReports = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (!hasSecret) return;
      setReportFetchState({ loading: true, error: null });
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (!reset && reportNextCursor) {
          params.set("cursor", reportNextCursor);
        }
        if (reset) {
          if (sinceInput) {
            const iso = parseDatetimeLocal(sinceInput);
            if (iso) params.set("since", iso);
          }
          if (hideReviewed) params.set("reviewed", "false");
        } else if (hideReviewed) {
          params.set("reviewed", "false");
        }
        const response = await fetch(`${API_BASE}?${params.toString()}`, {
          method: "GET",
          headers: { "x-admin-secret": secret },
        });
        if (response.status === 401) {
          setReportFetchState({
            loading: false,
            error: "Invalid admin secret",
          });
          return;
        }
        if (!response.ok) {
          setReportFetchState({
            loading: false,
            error: `Failed to load reports (${response.status})`,
          });
          return;
        }
        const data = (await response.json()) as ReportsResponse;
        setReportItems((prev) =>
          reset ? data.items : [...prev, ...data.items],
        );
        setReportNextCursor(data.nextCursor);
        setReportTotal(data.total);
        setReportFetchState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setReportFetchState({
          loading: false,
          error: "Unexpected error loading reports",
        });
      }
    },
    [hideReviewed, hasSecret, reportNextCursor, secret, sinceInput],
  );

  const loadPublished = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (!hasSecret) return;
      updateFetchStateForView("published", { loading: true, error: null });
      if (reset) {
        setPublishedItems([]);
        setPublishedNextCursor(null);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (!reset && publishedNextCursor) {
          params.set("cursor", publishedNextCursor);
        }
        const response = await fetch(
          `${PUBLISHED_API_BASE}?${params.toString()}`,
          {
            method: "GET",
            headers: { "x-admin-secret": secret },
          },
        );
        if (response.status === 401) {
          updateFetchStateForView("published", {
            loading: false,
            error: "Invalid admin secret",
          });
          return;
        }
        if (!response.ok) {
          updateFetchStateForView("published", {
            loading: false,
            error: `Failed to load published slugs (${response.status})`,
          });
          return;
        }
        const data = (await response.json()) as PublishedResponse;
        setPublishedItems((prev) =>
          reset ? data.items : [...prev, ...data.items],
        );
        setPublishedNextCursor(data.nextCursor);
        setPublishedTotal(data.total);
        updateFetchStateForView("published", { loading: false, error: null });
      } catch (error) {
        console.error(error);
        updateFetchStateForView("published", {
          loading: false,
          error: "Unexpected error loading published slugs",
        });
      }
    },
    [hasSecret, publishedNextCursor, secret],
  );

  useEffect(() => {
    if (!hasSecret) return;
    loadReports({ reset: true }).catch(() => {});
  }, [hasSecret, loadReports]);

  useEffect(() => {
    if (!hasSecret) return;
    if (view === "published" && publishedItems.length === 0) {
      loadPublished({ reset: true }).catch(() => {});
    }
  }, [hasSecret, loadPublished, publishedItems.length, view]);

  const activeFetchState =
    view === "reports" ? reportFetchState : publishedFetchState;
  const activeItems = view === "reports" ? reportItems : publishedItems;
  const activeTotal = view === "reports" ? reportTotal : publishedTotal;
  const activeNextCursor =
    view === "reports" ? reportNextCursor : publishedNextCursor;
  const loadNextPage =
    view === "reports"
      ? () => loadReports({ reset: false })
      : () => loadPublished({ reset: false });

  const handleSubmitSecret = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = secretInput.trim();
    setSecret(trimmed);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("adminSecret", trimmed);
    }
  };

  const markReviewed = async (slug: string) => {
    const prevItems = reportItems;
    setReportItems((current) =>
      current.map((item) =>
        item.slug === slug ? { ...item, reviewed: true } : item,
      ),
    );
    setReportFetchState({ loading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/${slug}`, {
        method: "PATCH",
        headers: {
          "x-admin-secret": secret,
        },
      });
      if (!response.ok) {
        setReportItems(prevItems);
        setReportFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to mark reviewed",
        });
      } else {
        setReportFetchState({ loading: false, error: null });
      }
    } catch (error) {
      console.error(error);
      setReportItems(prevItems);
      setReportFetchState({
        loading: false,
        error: "Failed to mark reviewed",
      });
    }
  };

  const performDelete = async (slug: string, actionView: AdminView) => {
    const prevReportItems = reportItems;
    const prevPublishedItems = publishedItems;
    updateFetchStateForView(actionView, { loading: true, error: null });
    try {
      const response = await fetch(`${PUBLISHED_API_BASE}/${slug}`, {
        method: "DELETE",
        headers: { "x-admin-override": secret },
      });
      if (!response.ok) {
        updateFetchStateForView(actionView, {
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to delete countdown",
        });
        return;
      }
      setReportItems(prevReportItems.filter((item) => item.slug !== slug));
      setPublishedItems(
        prevPublishedItems.filter((item) => item.slug !== slug),
      );
      updateFetchStateForView(actionView, { loading: false, error: null });
    } catch (error) {
      console.error(error);
      setReportItems(prevReportItems);
      setPublishedItems(prevPublishedItems);
      updateFetchStateForView(actionView, {
        loading: false,
        error: "Failed to delete countdown",
      });
    }
  };

  const performClear = async (slug: string) => {
    const prevItems = reportItems;
    setReportFetchState({ loading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/${slug}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      if (!response.ok) {
        setReportFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : "Failed to clear reports",
        });
        return;
      }
      const nowIso = new Date().toISOString();
      setReportItems((current) =>
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
      setReportFetchState({ loading: false, error: null });
    } catch (error) {
      console.error(error);
      setReportItems(prevItems);
      setReportFetchState({
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
          Enter the admin secret to review reported slugs and explore published
          countdowns.
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

  const renderReportsTable = () => (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[2fr,1fr,2fr,1fr,1fr,1.2fr] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
        <span>Slug</span>
        <span>Reports</span>
        <span>Last reason</span>
        <span>Last reported</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {reportItems.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {reportFetchState.loading
            ? "Loading reports..."
            : "No reports found."}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {reportItems.map((item) => (
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
                    disabled={reportFetchState.loading}
                  >
                    Mark reviewed
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  onClick={() =>
                    setConfirmAction({
                      type: "clear",
                      slug: item.slug,
                      view: "reports",
                    })
                  }
                  disabled={reportFetchState.loading}
                >
                  Clear reports
                </button>
                <button
                  type="button"
                  className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:opacity-90"
                  onClick={() =>
                    setConfirmAction({
                      type: "delete",
                      slug: item.slug,
                      view: "reports",
                    })
                  }
                  disabled={reportFetchState.loading}
                >
                  Delete countdown
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPublishedTable = () => (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[2fr,1.2fr,1.2fr,1.2fr,1fr,1.2fr] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
        <span>Slug</span>
        <span>Created</span>
        <span>Expires</span>
        <span>Target</span>
        <span>Password</span>
        <span>Actions</span>
      </div>
      {publishedItems.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {publishedFetchState.loading
            ? "Loading published slugs..."
            : "No published slugs yet."}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {publishedItems.map((item) => (
            <div
              key={item.slug}
              className="grid grid-cols-[2fr,1.2fr,1.2fr,1.2fr,1fr,1.2fr] items-start gap-3 px-4 py-3 text-sm"
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
                  {item.requiresPassword ? "Password protected" : "Open access"}
                </span>
              </div>
              <span className="text-muted-foreground">
                {formatTimestamp(item.createdAt)}
              </span>
              <span className="text-muted-foreground">
                {formatTimestamp(item.expiresAt)}
              </span>
              <span className="text-muted-foreground">
                {formatTimestamp(item.timeMs)}
              </span>
              <span className="text-muted-foreground">
                {item.requiresPassword ? "Yes" : "No"}
              </span>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  onClick={() =>
                    setConfirmAction({
                      type: "delete",
                      slug: item.slug,
                      view: "published",
                    })
                  }
                  disabled={publishedFetchState.loading}
                >
                  Delete countdown
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const viewDescription = useMemo(() => {
    if (view === "reports") {
      return "Review reported slugs. Filter, mark reviewed, and clear or delete problem entries.";
    }
    return "Browse every published countdown slug and delete protected content as needed.";
  }, [view]);

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Reports</h1>
            <p className="text-sm text-muted-foreground">{viewDescription}</p>
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

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="text-xs uppercase text-muted-foreground">View</span>
          <button
            type="button"
            onClick={() => setView("reports")}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              view === "reports"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground"
            }`}
          >
            Reported slugs
          </button>
          <button
            type="button"
            onClick={() => setView("published")}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              view === "published"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground"
            }`}
          >
            Published slugs
          </button>
        </div>

        {view === "reports" && (
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
                disabled={reportFetchState.loading}
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
                disabled={reportFetchState.loading}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {activeFetchState.error ? (
          <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {activeFetchState.error}
          </div>
        ) : null}

        {view === "reports" ? renderReportsTable() : renderPublishedTable()}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {activeItems.length} of {activeTotal}{" "}
            {view === "reports" ? "reported slug" : "published slug"}
            {activeTotal === 1 ? "" : "s"}
          </span>
          {activeNextCursor ? (
            <button
              type="button"
              onClick={loadNextPage}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              disabled={activeFetchState.loading}
            >
              {activeFetchState.loading ? "Loading..." : "Load more"}
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
                disabled={activeFetchState.loading}
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
                    performDelete(confirmAction.slug, confirmAction.view);
                  } else {
                    performClear(confirmAction.slug);
                  }
                  setConfirmAction(null);
                }}
                disabled={activeFetchState.loading}
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
