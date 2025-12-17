import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type CopyStatus = "idle" | "copied" | "error";

type ShareLinkActionsProps = {
  url: string;
  disabled?: boolean;
  onView?: () => void;
  className?: string;
};

export const ShareLinkActions = ({
  url,
  disabled = false,
  onView,
  className,
}: ShareLinkActionsProps) => {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== undefined) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleReset = (delayMs: number) => {
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      resetTimerRef.current = undefined;
    }, delayMs);
  };

  const copyEmoji = useMemo(() => {
    if (copyStatus === "copied") return "✅";
    if (copyStatus === "error") return "⚠️";
    return "🔗";
  }, [copyStatus]);

  const copyTooltip = useMemo(() => {
    if (copyStatus === "copied") return "Copied!";
    if (copyStatus === "error") return "Clipboard unavailable, copy manually.";
    return "Copy link";
  }, [copyStatus]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
      scheduleReset(2000);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
      setCopyStatus("error");
      scheduleReset(3500);
    }
  };

  const handleView = () => {
    if (onView) {
      onView();
      return;
    }
    window.location.href = url;
  };

  const ariaLiveText =
    copyStatus === "copied"
      ? "Copied link to clipboard."
      : copyStatus === "error"
        ? "Clipboard unavailable. Copy the link manually."
        : "";

  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const handleInputMouseUp = (event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <input
        type="text"
        value={url}
        readOnly
        onFocus={handleInputFocus}
        onMouseUp={handleInputMouseUp}
        className="min-w-0 flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70"
        aria-label="Shareable countdown URL"
      />
      <Button
        type="button"
        size="icon"
        onClick={handleCopy}
        disabled={disabled}
        title={copyTooltip}
        aria-label={copyTooltip}
      >
        {copyEmoji}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={handleView}
        disabled={disabled}
        title="Switch to view mode"
        aria-label="Switch to view mode"
      >
        👁️
      </Button>
      <span className="sr-only" aria-live="polite">
        {ariaLiveText}
      </span>
    </div>
  );
};
