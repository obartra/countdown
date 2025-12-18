import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type ReportModalProps = {
  slug: string;
  open: boolean;
  onClose: () => void;
};

type ReportStatus = "idle" | "pending" | "success" | "error";

export const ReportModal = ({ slug, open, onClose }: ReportModalProps) => {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const trimmedReason = reason.trim();
  const isSubmitDisabled =
    !trimmedReason || trimmedReason.length > 500 || status === "pending";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedReason) {
      setError("Please describe the issue.");
      setStatus("error");
      return;
    }
    setStatus("pending");
    setError(null);
    try {
      const response = await fetch(`/api/report/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          (payload as { error?: string } | null)?.error ||
            "Unable to submit the report.",
        );
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch (err) {
      console.warn("Report submission failed", err);
      setError("Unable to submit the report.");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setReason("");
    setStatus("idle");
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Report this countdown</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted-foreground underline"
          >
            Close
          </button>
        </div>
        {status === "success" ? (
          <p className="text-sm text-muted-foreground">
            Thanks for reporting. We will review this shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe what makes this countdown problematic (max 500 characters)."
              className="h-32"
              maxLength={500}
              disabled={status === "pending"}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{trimmedReason.length}/500</span>
              {error ? <span className="text-destructive">{error}</span> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={status === "pending"}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {status === "pending" ? "Reporting…" : "Submit report"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
