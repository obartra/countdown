import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { deriveCountdownMeta, parseParamsFromSearch } from "./countdown";

import "./style.css";

const EditPage = lazy(() => import("./EditPage"));

document.documentElement.classList.add("h-full");
document.body.classList.add("min-h-screen", "antialiased");

export const Root = () => {
  const params = parseParamsFromSearch(window.location.search);
  const { state } = deriveCountdownMeta(params);
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const search = new URLSearchParams(window.location.search);
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
