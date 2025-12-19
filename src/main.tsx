import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { deriveCountdownMeta, parseParamsFromSearch } from "./countdown";
import {
  canonicalizeCountdownSearchParams,
  mergeCountdownSearchParamsWithOverrides,
} from "./countdownUrl";
import LoadingScreen from "./components/LoadingScreen";

import "./style.css";

const EditPage = lazy(() => import("./EditPage"));
const AdminReportsPage = lazy(() => import("./AdminReportsPage"));
const AdminPage = lazy(() => import("./AdminPage"));

document.documentElement.classList.add("h-full");
document.body.classList.add("min-h-screen", "antialiased");

type PublishedSlugRecord = {
  slug: string;
  payload: string;
  meta: {
    slug: string;
    createdAt: number;
    timeMs: number;
    expiresAt?: number;
    published: boolean;
    requiresPassword?: boolean;
  };
};

type PublishedEditContext = {
  slug: string;
  expiresAt?: number;
  requiresPassword: boolean;
};

export const Root = () => {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const rawSearch = typeof window !== "undefined" ? window.location.search : "";

  const slugCandidate = useMemo(() => {
    if (!pathname) return null;
    const segments = pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    if (segments.length < 2) return null;
    if (segments[0] !== "v") return null;
    if (segments.length === 3 && segments[2] !== "edit") return null;
    if (segments.length > 3) return null;
    return segments[1].toLowerCase();
  }, [pathname]);

  const [slugRecord, setSlugRecord] = useState<PublishedSlugRecord | null>(
    null,
  );
  const [slugFetchStatus, setSlugFetchStatus] = useState<
    "idle" | "loading" | "ready"
  >(() => (slugCandidate ? "loading" : "idle"));

  useEffect(() => {
    if (!slugCandidate) {
      setSlugRecord(null);
      setSlugFetchStatus("idle");
      return;
    }
    setSlugRecord(null);
    setSlugFetchStatus("loading");
    let canceled = false;
    const fetchSlug = async () => {
      try {
        const response = await fetch(`/api/published/${slugCandidate}`, {
          method: "GET",
        });
        if (!response.ok) throw new Error("Slug not found");
        const data = await response.json();
        if (!canceled) {
          setSlugRecord(data);
          setSlugFetchStatus("ready");
        }
      } catch {
        if (!canceled) {
          setSlugRecord(null);
          setSlugFetchStatus("ready");
        }
      }
    };
    fetchSlug();
    return () => {
      canceled = true;
    };
  }, [slugCandidate]);

  const slugPayload = slugRecord?.payload ?? null;
  const canonicalSearchParams = useMemo(() => {
    if (slugPayload) {
      return mergeCountdownSearchParamsWithOverrides(slugPayload, rawSearch);
    }
    return canonicalizeCountdownSearchParams(rawSearch);
  }, [rawSearch, slugPayload]);
  const canonicalSearchString = canonicalSearchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (slugPayload) return;
    const current = window.location.search.replace(/^\?/, "");
    if (current === canonicalSearchString) return;
    const url = new URL(window.location.href);
    url.search = canonicalSearchString;
    window.history.replaceState(null, "", url.toString());
  }, [canonicalSearchString, slugPayload]);

  const params = useMemo(
    () => parseParamsFromSearch(canonicalSearchString),
    [canonicalSearchString],
  );
  const { state } = useMemo(() => deriveCountdownMeta(params), [params]);
  const search = canonicalSearchParams;
  const forceEditFlag =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("forceEdit") === "1";

  if (forceEditFlag && typeof window !== "undefined") {
    window.sessionStorage.removeItem("forceEdit");
  }

  const hasEditPath = pathname.endsWith("/edit");
  const hasEditParam = search.has("edit");

  const showEditor =
    forceEditFlag || hasEditPath || hasEditParam || state === "helper";

  const isAdminReports =
    typeof window !== "undefined" && pathname.startsWith("/admin/reports");
  const isAdminRoot =
    typeof window !== "undefined" &&
    (pathname === "/admin" || pathname === "/admin/");

  if (isAdminRoot) {
    return (
      <Suspense fallback={<LoadingScreen message="Loading admin..." />}>
        <AdminPage />
      </Suspense>
    );
  }

  if (isAdminReports) {
    return (
      <Suspense fallback={<LoadingScreen message="Loading admin reports..." />}>
        <AdminReportsPage />
      </Suspense>
    );
  }

  if (slugCandidate && slugFetchStatus === "loading") {
    return <LoadingScreen message="Loading published countdown..." />;
  }

  const publishedSlug = slugRecord?.meta?.slug ?? null;
  const publishedEditContext: PublishedEditContext | null = slugRecord
    ? {
        slug: slugRecord.meta.slug,
        expiresAt: slugRecord.meta.expiresAt,
        requiresPassword: Boolean(slugRecord.meta.requiresPassword),
      }
    : null;

  return showEditor ? (
    <Suspense fallback={<LoadingScreen message="Loading editor..." />}>
      <EditPage
        initialParams={params}
        publishedContext={publishedEditContext}
        publishedDefaultsSearch={slugPayload ?? undefined}
      />
    </Suspense>
  ) : (
    <App initialParams={params} publishedSlug={publishedSlug} />
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
