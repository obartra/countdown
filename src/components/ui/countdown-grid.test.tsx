import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { CountdownGrid } from "./countdown-grid";

const parts = [
  { label: "Days", value: "1", key: "days" },
  { label: "Hours", value: "02", key: "hours" },
  { label: "Minutes", value: "03", key: "minutes" },
  { label: "Seconds", value: "04", key: "seconds" },
];

describe("CountdownGrid", () => {
  it("renders parts and end time info when shown", () => {
    render(
      <CountdownGrid
        parts={parts}
        endDateDisplay="Tue, Jan 1"
        timeZoneNameLong="UTC"
        offsetString="+00:00"
        showCountdown
      />,
    );

    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Tue, Jan 1")).toBeInTheDocument();
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it("hides when not showing countdown", () => {
    render(
      <CountdownGrid
        parts={parts}
        endDateDisplay="Tue, Jan 1"
        timeZoneNameLong="UTC"
        offsetString="+00:00"
        showCountdown={false}
      />,
    );

    const container = screen.getByText("Days").closest("div")
      ?.parentElement?.parentElement;
    expect(container?.parentElement).toHaveStyle({ display: "none" });
  });
});
