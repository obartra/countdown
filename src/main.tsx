import React, { lazy, Suspense, useEffect, useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { deriveCountdownMeta, parseParamsFromSearch } from "./countdown";
import { canonicalizeCountdownSearchParams } from "./countdownUrl";

import "./style.css";

const EditPage = lazy(() => import("./EditPage"));

document.documentElement.classList.add("h-full");
document.body.classList.add("min-h-screen", "antialiased");

export const Root = () => {
  const rawSearch = typeof window !== "undefined" ? window.location.search : "";
  const canonicalSearchParams = useMemo(
    () => canonicalizeCountdownSearchParams(rawSearch),
    [rawSearch],
  );
  const canonicalSearchString = canonicalSearchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = window.location.search.replace(/^\?/, "");
    if (current === canonicalSearchString) return;
    const url = new URL(window.location.href);
    url.search = canonicalSearchString;
    window.history.replaceState(null, "", url.toString());
  }, [canonicalSearchString]);

  const params = useMemo(
    () => parseParamsFromSearch(canonicalSearchString),
    [canonicalSearchString],
  );
  const { state } = useMemo(() => deriveCountdownMeta(params), [params]);
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
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

  return showEditor ? (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading editor...
        </div>
      }
    >
      <EditPage initialParams={params} />
    </Suspense>
  ) : (
    <App initialParams={params} />
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
