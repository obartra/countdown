import { describe, expect, test } from "vitest";

import { generateRandomSlug, normalizeSlugInput } from "./slug";

describe("normalizeSlugInput", () => {
  test("lowercases and accepts valid slugs", () => {
    expect(normalizeSlugInput("Abc-123")).toBe("abc-123");
    expect(normalizeSlugInput("foo")).toBe("foo");
    expect(normalizeSlugInput("a-long-slug")).toBe("a-long-slug");
  });

  test("rejects slugs that violate rules", () => {
    expect(normalizeSlugInput("bad slug")).toBeNull();
    expect(normalizeSlugInput("ab")).toBeNull(); // too short
    expect(normalizeSlugInput("-lead")).toBeNull();
    expect(normalizeSlugInput("trailing-")).toBeNull();
    expect(normalizeSlugInput("double--dash")).toBeNull();
    expect(normalizeSlugInput("edit")).toBe("edit");
  });
});

describe("generateRandomSlug", () => {
  test("returns lowercase alphanumeric strings of the requested length", () => {
    const slug = generateRandomSlug();
    expect(slug).toHaveLength(7);
    expect(/^[a-z0-9]+$/.test(slug)).toBe(true);

    const longer = generateRandomSlug(12);
    expect(longer).toHaveLength(12);
    expect(/^[a-z0-9]+$/.test(longer)).toBe(true);
  });
});
