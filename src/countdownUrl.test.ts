import {
  buildCanonicalCountdownSearchParams,
  buildOverrideCountdownSearchParams,
  canonicalizeCountdownSearchParams,
  mergeCountdownSearchParamsWithOverrides,
} from "./countdownUrl";

describe("countdownUrl canonicalization", () => {
  it("is idempotent for already-canonical URLs", () => {
    const canonical = canonicalizeCountdownSearchParams(
      "?date=2030-01-01T00:00:00Z&complete=Time%20is%20up!&bgcolor=fff&foo=1&foo=2",
    ).toString();
    const secondPass = canonicalizeCountdownSearchParams(canonical).toString();

    expect(secondPass).toBe(canonical);
  });

  it("omits the default complete text", () => {
    const params = buildCanonicalCountdownSearchParams({
      time: "2030-01-01T00:00:00Z",
      complete: "Time is up!",
    });

    expect(params.get("time")).toBe("2030-01-01T00:00:00Z");
    expect(params.has("complete")).toBe(false);
  });

  it("trims URL values and omits empty text params", () => {
    const params = buildCanonicalCountdownSearchParams({
      time: " 2030-01-01T00:00:00Z ",
      title: "  Hello  ",
      description: "   ",
      footer: "\nFooter\t",
      image: "  openverse:abc  ",
      complete: "  Time is up!  ",
    });

    expect(params.get("time")).toBe("2030-01-01T00:00:00Z");
    expect(params.get("title")).toBe("Hello");
    expect(params.has("description")).toBe(false);
    expect(params.get("footer")).toBe("Footer");
    expect(params.get("image")).toBe("openverse:abc");
    expect(params.has("complete")).toBe(false);
  });

  it("omits default theme colors only when both are provided", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "#111113",
      color: "#EDEEF0",
    });

    expect(params.has("bgcolor")).toBe(false);
    expect(params.has("color")).toBe(false);
  });

  it("keeps a single bgcolor override even if it equals the default theme background", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "#111113",
    });

    expect(params.get("bgcolor")).toBe("#111113");
    expect(params.has("color")).toBe(false);
  });

  it("canonicalizes hex triplets and casing", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: " #FfF ",
    });

    expect(params.get("bgcolor")).toBe("#ffffff");
  });

  it("canonicalizes named colors to hex", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "WHITE",
    });

    expect(params.get("bgcolor")).toBe("#ffffff");
  });

  it("canonicalizes rgb() colors to hex", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "rgb(255, 255, 255)",
    });

    expect(params.get("bgcolor")).toBe("#ffffff");
  });

  it("omits redundant implied colors when both are provided", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "#ffffff",
      color: "#000000",
    });

    expect(params.get("bgcolor")).toBe("#ffffff");
    expect(params.has("color")).toBe(false);
  });

  it("preserves both colors when neither is implied", () => {
    const params = buildCanonicalCountdownSearchParams({
      bgcolor: "#123456",
      color: "#abcdef",
    });

    expect(params.get("bgcolor")).toBe("#123456");
    expect(params.get("color")).toBe("#abcdef");
  });

  it("canonicalizes date -> time and preserves non-countdown params", () => {
    const params = canonicalizeCountdownSearchParams(
      "?date=2030-01-01T00:00:00Z&edit=1&complete=Time%20is%20up!",
    );

    expect(params.get("time")).toBe("2030-01-01T00:00:00Z");
    expect(params.has("date")).toBe(false);
    expect(params.has("complete")).toBe(false);
    expect(params.get("edit")).toBe("1");
  });

  it("preserves repeated and empty non-countdown params", () => {
    const params = canonicalizeCountdownSearchParams(
      "?date=2030-01-01T00:00:00Z&foo=1&foo=2&bar=",
    );

    expect(params.get("time")).toBe("2030-01-01T00:00:00Z");
    expect(params.has("date")).toBe(false);
    expect(params.getAll("foo")).toEqual(["1", "2"]);
    expect(params.get("bar")).toBe("");
  });

  it("prefers the date alias when time is present but empty", () => {
    const params = canonicalizeCountdownSearchParams(
      "?time=&date=2030-01-01T00:00:00Z",
    );

    expect(params.get("time")).toBe("2030-01-01T00:00:00Z");
  });
});

describe("countdownUrl slug defaults", () => {
  it("merges stored payload with URL overrides", () => {
    const base = "time=2030-01-01T00:00:00Z&title=Base";
    const merged = mergeCountdownSearchParamsWithOverrides(
      base,
      "?title=Override&edit=1",
    );

    expect(merged.get("time")).toBe("2030-01-01T00:00:00Z");
    expect(merged.get("title")).toBe("Override");
    expect(merged.get("edit")).toBe("1");
  });

  it("treats empty override values as explicit clears", () => {
    const base = "time=2030-01-01T00:00:00Z&title=Base";
    const merged = mergeCountdownSearchParamsWithOverrides(base, "?title=");

    expect(merged.get("title")).toBe("");
  });

  it("builds override-only query params compared to stored payload", () => {
    const base = "time=2030-01-01T00:00:00Z&title=Base";
    const overrides = buildOverrideCountdownSearchParams(
      base,
      { time: "2030-01-01T00:00:00Z", title: "Base" },
      "?edit=1",
    );

    expect(overrides.toString()).toBe("edit=1");
  });

  it("writes an empty key when clearing a stored value", () => {
    const base = "time=2030-01-01T00:00:00Z&title=Base";
    const overrides = buildOverrideCountdownSearchParams(
      base,
      { time: "2030-01-01T00:00:00Z", title: "" },
      "",
    );

    expect(overrides.get("title")).toBe("");
    expect(overrides.has("time")).toBe(false);
  });
});
