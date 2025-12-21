import React, { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "./lib/useAdminAuth";

type AdminStats = {
  totalActive: number;
  anonymousActive: number;
  passwordProtectedActive: number;
  publishes: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  rateLimitHitsLast24Hours: number;
  failedDeleteAttemptsLast24Hours: number;
};

type FetchState = {
  loading: boolean;
  error: string | null;
};

const AdminPage: React.FC = () => {
  const {
    secret,
    secretInput,
    setSecretInput,
    status: authStatus,
    error: authError,
    hasSecret,
    verify: verifySecret,
    clear: clearAuth,
  } = useAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!hasSecret) return;
    const loadStats = async () => {
      setFetchState({ loading: true, error: null });
      try {
        const response = await fetch("/admin-stats", {
          headers: { "x-admin-secret": secret },
        });
        if (!response.ok) {
          setFetchState({
            loading: false,
            error:
              response.status === 401
                ? "Invalid admin secret"
                : `Failed to load stats (${response.status})`,
          });
          return;
        }
        const data = (await response.json()) as AdminStats;
        setStats(data);
        setFetchState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setFetchState({
          loading: false,
          error: "Unexpected error loading stats",
        });
      }
    };
    loadStats().catch(() => {});
  }, [hasSecret, secret]);

  const handleSubmitSecret = async (event: React.FormEvent) => {
    event.preventDefault();
    await verifySecret(secretInput);
  };

  const handleOpenStatsJson = async () => {
    if (!hasSecret) return;
    setFetchState({ loading: true, error: null });
    try {
      const response = await fetch("/admin-stats", {
        headers: { "x-admin-secret": secret },
      });
      if (!response.ok) {
        setFetchState({
          loading: false,
          error:
            response.status === 401
              ? "Invalid admin secret"
              : `Failed to load stats (${response.status})`,
        });
        return;
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setFetchState({ loading: false, error: null });
    } catch (error) {
      console.error(error);
      setFetchState({
        loading: false,
        error: "Failed to open JSON (check secret)",
      });
    }
  };

  const secretForm = (
    <form
      onSubmit={handleSubmitSecret}
      className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admin Access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the admin secret to access moderation tools and stats.
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
      {authError ? (
        <p className="text-sm text-destructive">{authError}</p>
      ) : null}
      <button
        type="submit"
        disabled={authStatus === "pending"}
        className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        {authStatus === "pending" ? "Verifying..." : "Continue"}
      </button>
    </form>
  );

  const statsSummary = useMemo(() => {
    if (!stats) return null;
    return [
      { label: "Active", value: stats.totalActive },
      { label: "Password protected", value: stats.passwordProtectedActive },
      { label: "Anonymous", value: stats.anonymousActive },
      { label: "Publishes 24h", value: stats.publishes.last24Hours },
      { label: "Rate limit hits 24h", value: stats.rateLimitHitsLast24Hours },
    ];
  }, [stats]);

  const clearSecret = () => {
    clearAuth();
    setStats(null);
    setFetchState({ loading: false, error: null });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin</h1>
            <p className="text-sm text-muted-foreground">
              Jump to moderation tools or view recent stats.
            </p>
          </div>
          <a
            href="/"
            className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            ← Back to countdown
          </a>
        </div>

        {!hasSecret ? (
          secretForm
        ) : (
          <>
            {fetchState.error ? (
              <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {fetchState.error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <a
                href="/admin/reports"
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Reports & Published
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Review reported slugs, published slugs, and delete or
                      clear content.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Go
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uses the admin secret to access moderation endpoints. Opens
                  the combined reports/published dashboard.
                </p>
              </a>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Stats</h2>
                    <p className="text-sm text-muted-foreground">
                      Recent publish and moderation activity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenStatsJson}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    disabled={fetchState.loading}
                  >
                    View JSON
                  </button>
                </div>
                {fetchState.loading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading stats…
                  </p>
                ) : stats && statsSummary ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {statsSummary.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-border bg-background px-3 py-2"
                      >
                        <div className="text-xs uppercase text-muted-foreground">
                          {item.label}
                        </div>
                        <div className="text-base font-semibold text-foreground">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No stats available yet.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <p className="text-sm text-muted-foreground">
                      Admin secret is stored in sessionStorage.
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {hasSecret
                    ? "Secret stored for this session."
                    : "No secret set."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    onClick={clearSecret}
                  >
                    Clear secret
                  </button>
                  {!hasSecret ? (
                    <a
                      href="/admin"
                      className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Enter secret
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
