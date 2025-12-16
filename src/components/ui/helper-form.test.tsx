import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { HelperForm } from "./helper-form";

describe("HelperForm", () => {
  it("calls submit and change handlers", () => {
    const setHelperValue = vi.fn();
    const setHelperError = vi.fn();
    const onPrefill = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) =>
      e.preventDefault(),
    );

    render(
      <HelperForm
        show
        helperValue="2024-12-31T23:59:59Z"
        setHelperValue={setHelperValue}
        helperError=""
        setHelperError={setHelperError}
        onPrefill={onPrefill}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Countdown end time/i), {
      target: { value: "2025-01-01T00:00:00Z" },
    });
    expect(setHelperValue).toHaveBeenCalledWith("2025-01-01T00:00:00Z");

    fireEvent.click(
      screen.getByRole("button", { name: /Set to 24h from now/i }),
    );
    expect(onPrefill).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Start countdown/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows helper error text", () => {
    render(
      <HelperForm
        show
        helperValue=""
        setHelperValue={vi.fn()}
        helperError="error text"
        setHelperError={vi.fn()}
        onPrefill={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("error text")).toBeInTheDocument();
  });
});
