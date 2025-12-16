import React, { createContext, useContext } from "react";
import { type CountdownParams, type CountdownState } from "../countdown";

export type CountdownContextValue = {
  params: CountdownParams;
  state: CountdownState;
  setState: React.Dispatch<React.SetStateAction<CountdownState>>;
  helperValue: string;
  setHelperValue: React.Dispatch<React.SetStateAction<string>>;
  helperError: string;
  setHelperError: React.Dispatch<React.SetStateAction<string>>;
  countdownDisplay: {
    label: string;
    totalMs: number;
    parts: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
  };
  setCountdownDisplay: React.Dispatch<
    React.SetStateAction<{
      label: string;
      totalMs: number;
      parts: { days: number; hours: number; minutes: number; seconds: number };
    }>
  >;
  trimmedTime: string;
  targetDate: Date | null;
  handleHelperSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onPrefill: () => void;
};

const CountdownContext = createContext<CountdownContextValue | null>(null);

export const CountdownProvider = ({
  value,
  children,
}: {
  value: CountdownContextValue;
  children: React.ReactNode;
}) => (
  <CountdownContext.Provider value={value}>
    {children}
  </CountdownContext.Provider>
);

export const useCountdownContext = () => {
  const ctx = useContext(CountdownContext);
  if (!ctx) {
    throw new Error(
      "useCountdownContext must be used within a CountdownProvider",
    );
  }
  return ctx;
};
