import { describe, expect, it } from "vitest";

import { formatRelativeExpiry } from "./formatRelativeExpiry";

describe("formatRelativeExpiry", () => {
  const baseTime = 1680000000000; // arbitrary fixed timestamp

  it("shows today when expires later the same day", () => {
    expect(formatRelativeExpiry(baseTime + 1000 * 60, baseTime)).toBe(
      "Expires today",
    );
  });

  it("shows 1 day when exactly 1 day remaining", () => {
    expect(formatRelativeExpiry(baseTime + 24 * 60 * 60 * 1000, baseTime)).toBe(
      "Expires in 1 day",
    );
  });

  it("shows days when remaining is under 30 days", () => {
    expect(
      formatRelativeExpiry(baseTime + 5 * 24 * 60 * 60 * 1000, baseTime),
    ).toBe("Expires in 5 days");
  });

  it("shows months when under a year", () => {
    expect(
      formatRelativeExpiry(baseTime + 45 * 24 * 60 * 60 * 1000, baseTime),
    ).toBe("Expires in 1 month");
    expect(
      formatRelativeExpiry(baseTime + 90 * 24 * 60 * 60 * 1000, baseTime),
    ).toBe("Expires in 3 months");
  });

  it("shows years when a year or more remains", () => {
    expect(
      formatRelativeExpiry(baseTime + 365 * 24 * 60 * 60 * 1000, baseTime),
    ).toBe("Expires in 1 year");
    expect(
      formatRelativeExpiry(baseTime + 800 * 24 * 60 * 60 * 1000, baseTime),
    ).toBe("Expires in 2 years");
  });
});
