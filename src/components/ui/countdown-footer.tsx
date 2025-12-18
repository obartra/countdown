import React from "react";
import { type ResolvedImage } from "../../imageResolver";

type CountdownFooterProps = {
  showFooter: boolean;
  footerText?: string;
  resolvedImage: ResolvedImage | null;
  footerRef: React.RefObject<HTMLElement | null>;
  reportAction?: { onClick: () => void; label?: string };
};

export const CountdownFooter = ({
  showFooter,
  footerText,
  resolvedImage,
  footerRef,
  reportAction,
}: CountdownFooterProps) => {
  const showAttribution = Boolean(resolvedImage?.attribution);

  if (!showFooter && !showAttribution && !reportAction) return null;

  const segments: Array<{ key: string; node: React.ReactNode }> = [];

  if (showFooter && footerText) {
    segments.push({ key: "footer", node: <span>{footerText}</span> });
  }

  if (showAttribution) {
    segments.push({
      key: "attribution",
      node: (
        <span className="text-xs">
          {resolvedImage?.attribution?.href ? (
            <a
              href={resolvedImage.attribution.href}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {resolvedImage.attribution.text}
            </a>
          ) : (
            resolvedImage?.attribution?.text
          )}
        </span>
      ),
    });
  }

  if (reportAction) {
    segments.push({
      key: "report",
      node: (
        <button
          type="button"
          onClick={reportAction.onClick}
          className="text-xs font-semibold text-primary underline"
        >
          {reportAction.label ?? "Report this countdown"}
        </button>
      ),
    });
  }

  return (
    <footer
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground"
      ref={footerRef as React.RefObject<HTMLElement>}
    >
      {segments.length > 0 ? (
        <p id="page-footer" className="text-left">
          {segments.map((segment, index) => (
            <React.Fragment key={segment.key}>
              {index > 0 ? <span> - </span> : null}
              {segment.node}
            </React.Fragment>
          ))}
        </p>
      ) : null}
    </footer>
  );
};
