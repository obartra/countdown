import React from "react";
import { type ResolvedImage } from "../../imageResolver";

type CountdownFooterProps = {
  showFooter: boolean;
  footerText?: string;
  resolvedImage: ResolvedImage | null;
  attributionBackground: string;
  textColor: string;
  footerRef: React.RefObject<HTMLElement | null>;
};

export const CountdownFooter = ({
  showFooter,
  footerText,
  resolvedImage,
  attributionBackground,
  textColor,
  footerRef,
}: CountdownFooterProps) => {
  const showAttribution = Boolean(resolvedImage?.attribution);

  if (!showFooter && !showAttribution) return null;

  return (
    <footer
      className="mt-auto flex w-full flex-col gap-2 pt-4 text-sm text-muted-foreground"
      ref={footerRef as React.RefObject<HTMLElement>}
      style={{
        color: textColor,
      }}
    >
      {showAttribution ? (
        <div
          className="w-full text-left text-xs"
          style={{
            backgroundColor: attributionBackground,
            maxHeight: 50,
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
          }}
        >
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
        </div>
      ) : null}
      {showFooter ? <p id="page-footer">{footerText}</p> : null}
    </footer>
  );
};
