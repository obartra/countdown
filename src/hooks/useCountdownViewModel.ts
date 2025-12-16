import { useEffect, useMemo, useState } from "react";
import {
  CountdownParams,
  CountdownState,
  deriveCountdownMeta,
  formatCountdown,
  parseParamsFromSearch,
} from "../countdown";

type ViewModel = {
  params: CountdownParams;
  state: CountdownState;
  setState: React.Dispatch<React.SetStateAction<CountdownState>>;
  helperValue: string;
  setHelperValue: React.Dispatch<React.SetStateAction<string>>;
  helperError: string;
  setHelperError: React.Dispatch<React.SetStateAction<string>>;
  countdownDisplay: ReturnType<typeof formatCountdown>;
  setCountdownDisplay: React.Dispatch<
    React.SetStateAction<ReturnType<typeof formatCountdown>>
  >;
  trimmedTime: string;
  targetDate: Date | null;
  handleHelperSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onPrefill: () => void;
};

export const useCountdownViewModel = (
  initialParams?: CountdownParams,
): ViewModel => {
  const params = useMemo(
    () => initialParams ?? parseParamsFromSearch(window.location.search),
    [initialParams],
  );
  const {
    trimmedTime,
    targetDate,
    state: initialState,
  } = useMemo(() => deriveCountdownMeta(params), [params]);

  const [state, setState] = useState<CountdownState>(initialState);
  const [helperValue, setHelperValue] = useState(trimmedTime);
  const [helperError, setHelperError] = useState("");
  const [countdownDisplay, setCountdownDisplay] = useState(() =>
    state === "countdown" && targetDate
      ? formatCountdown(targetDate.getTime() - Date.now())
      : {
          label: "",
          totalMs: 0,
          parts: { days: 0, hours: 0, minutes: 0, seconds: 0 },
        },
  );

  useEffect(() => {
    document.body.style.backgroundColor = params.backgroundColor;
    document.body.style.color = params.textColor;
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [params.backgroundColor, params.textColor]);

  useEffect(() => {
    if (state !== "countdown" || !targetDate) {
      return undefined;
    }

    const tick = () => {
      const remaining = targetDate.getTime() - Date.now();
      if (remaining <= 0) {
        setState("complete");
        setCountdownDisplay({
          label: "",
          totalMs: 0,
          parts: { days: 0, hours: 0, minutes: 0, seconds: 0 },
        });
        return;
      }
      setCountdownDisplay(formatCountdown(remaining));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state, targetDate]);

  useEffect(() => {
    if (state === "countdown" && countdownDisplay.label) {
      document.title = `${trimmedTime ? `${trimmedTime} - ` : ""}${countdownDisplay.label} remaining`;
    } else if (state === "complete") {
      document.title = params.completeText;
    } else {
      document.title = "Countdown";
    }
  }, [countdownDisplay.label, params.completeText, state, trimmedTime]);

  const handleHelperSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = helperValue.trim();

    if (!value || Number.isNaN(Date.parse(value))) {
      setHelperError(
        "Enter a valid time in ISO UTC, e.g., 2025-01-01T00:00:00Z.",
      );
      return;
    }

    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("time", value);
    nextParams.delete("date");
    const nextSearch = nextParams.toString();
    if (nextSearch === window.location.search.replace(/^\?/, "")) {
      setState(Date.parse(value) <= Date.now() ? "complete" : "countdown");
      setHelperError("");
      return;
    }
    window.location.search = nextSearch;
  };

  const onPrefill = () => {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    setHelperValue(next);
    setHelperError("");
  };

  return {
    params,
    state,
    setState,
    helperValue,
    setHelperValue,
    helperError,
    setHelperError,
    countdownDisplay,
    setCountdownDisplay,
    trimmedTime,
    targetDate,
    handleHelperSubmit,
    onPrefill,
  };
};
