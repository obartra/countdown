import React from "react";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

type HelperFormProps = {
  show: boolean;
  helperValue: string;
  setHelperValue: (value: string) => void;
  helperError: string;
  setHelperError: (value: string) => void;
  onPrefill: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const HelperForm = ({
  show,
  helperValue,
  setHelperValue,
  helperError,
  setHelperError,
  onPrefill,
  onSubmit,
}: HelperFormProps) => {
  return (
    <section id="time-helper" className={show ? "block" : "hidden"}>
      <Alert variant="warning" className="text-left">
        <AlertTitle className="text-base font-semibold">
          Add a countdown time to get started
        </AlertTitle>
        <AlertDescription className="text-sm">
          Provide an ISO UTC time (e.g.,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            2025-01-01T00:00:00Z
          </code>
          ). We will reload the page with that value and keep any other settings
          you already set.
        </AlertDescription>
        <form
          id="time-helper-form"
          className="mt-4 space-y-3"
          onSubmit={onSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="time-input">Countdown end time</Label>
            <Input
              id="time-input"
              type="text"
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
              autoComplete="off"
              value={helperValue}
              onChange={(event) => {
                setHelperValue(event.target.value);
                if (helperError) setHelperError("");
              }}
            />
            <p id="time-input-feedback" className="text-sm text-destructive">
              {helperError}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              id="prefill-24h"
              type="button"
              variant="outline"
              onClick={onPrefill}
            >
              Set to 24h from now
            </Button>
            <Button id="start-countdown" type="submit">
              Start countdown
            </Button>
          </div>
        </form>
      </Alert>
    </section>
  );
};
