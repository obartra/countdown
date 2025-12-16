import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DEFAULT_THEME_KEY, themeMap, themes } from "./themes";
import {
  CountdownParams,
  CountdownState,
  dateFormatter,
  deriveColors,
  deriveCountdownMeta,
  formatCountdown,
  parseParamsFromSearch,
} from "./countdown";
import { resolveImage } from "./imageResolver";
import { searchOpenverse, searchTenor, type SearchResult } from "./imageSearch";

type EditorForm = {
  time: string;
  title: string;
  description: string;
  footer: string;
  completeText: string;
  image: string;
  bgcolor: string;
  color: string;
  themeKey: string;
  imageInput: string;
};

type TimePreset = {
  label: string;
  compute: (now: Date) => Date;
};

const dedupeResults = (items: SearchResult[]) => {
  const map = new Map<string, SearchResult>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

const isLightBackground = (hexColor: string) => {
  const normalized = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance >= 0.6;
};

const timePresets: TimePreset[] = [
  {
    label: "+30m",
    compute: (now) => new Date(now.getTime() + 30 * 60 * 1000),
  },
  {
    label: "+1h",
    compute: (now) => new Date(now.getTime() + 60 * 60 * 1000),
  },
  {
    label: "Tomorrow 9:00 AM",
    compute: (now) => {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    },
  },
];

const buildSearchParams = (form: EditorForm) => {
  const search = new URLSearchParams();
  if (form.time.trim()) search.set("time", form.time.trim());
  if (form.title.trim()) search.set("title", form.title.trim());
  if (form.description.trim())
    search.set("description", form.description.trim());
  if (form.footer.trim()) search.set("footer", form.footer.trim());
  if (form.completeText.trim())
    search.set("complete", form.completeText.trim());
  if (form.image.trim()) search.set("image", form.image.trim());
  if (form.bgcolor.trim()) search.set("bgcolor", form.bgcolor.trim());
  if (form.color.trim()) search.set("color", form.color.trim());
  return search;
};

const buildShareUrl = (form: EditorForm) => {
  const search = buildSearchParams(form);
  const url = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  url.search = search.toString();
  return url.toString();
};

type EditPageProps = {
  initialParams?: CountdownParams;
};

const toLocalDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

const EditPage = ({ initialParams }: EditPageProps) => {
  const params = useMemo(
    () => initialParams ?? parseParamsFromSearch(window.location.search),
    [initialParams],
  );

  const [form, setForm] = useState<EditorForm>({
    time: params.rawTime,
    title: params.title || "",
    description: params.description || "",
    footer: params.footer || "",
    completeText:
      params.completeText === "Time is up!" ? "" : params.completeText || "",
    image: params.image || "",
    bgcolor: params.backgroundColor || "",
    color: params.textColor || "",
    themeKey: params.isCustomTheme
      ? "custom"
      : params.themeKey || DEFAULT_THEME_KEY,
    imageInput: "",
  });
  const [localTimeInput, setLocalTimeInput] = useState<Date | null>(() =>
    toLocalDate(params.rawTime),
  );

  const [countdownState, setCountdownState] =
    useState<CountdownState>("helper");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [imageResults, setImageResults] = useState<SearchResult[]>([]);
  const [nextOvPage, setNextOvPage] = useState<number | null>(null);
  const [nextTenorPos, setNextTenorPos] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const searchDebounceRef = useRef<number | undefined>();

  const colors = useMemo(
    () => deriveColors(form.bgcolor || null, form.color || null),
    [form.bgcolor, form.color],
  );

  const previewParams: CountdownParams = {
    rawTime: form.time,
    title: form.title || undefined,
    description: form.description || undefined,
    footer: form.footer || undefined,
    image: form.image || undefined,
    completeText: form.completeText || "Time is up!",
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    themeKey: colors.themeKey,
    isCustomTheme: colors.isCustomTheme,
  };

  const { targetDate, state: metaState } = useMemo(
    () => deriveCountdownMeta(previewParams),
    [previewParams],
  );

  useEffect(() => {
    setCountdownState(metaState);
  }, [metaState]);

  useEffect(() => {
    if (metaState !== "countdown" || !targetDate) {
      setCountdownLabel("");
      return undefined;
    }

    const tick = () => {
      const remaining = targetDate.getTime() - Date.now();
      if (remaining <= 0) {
        setCountdownState("complete");
        setCountdownLabel("");
        return;
      }
      setCountdownLabel(formatCountdown(remaining).label);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [metaState, targetDate]);

  const endDateText = targetDate ? dateFormatter(targetDate) : "";
  const timeZoneName = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const localTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: timeZoneName,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    [timeZoneName],
  );
  const hasTimeError = !localTimeInput;
  const interpretedUtc = localTimeInput ? localTimeInput.toISOString() : "";
  const interpretedLocal = localTimeInput
    ? localTimeFormatter.format(localTimeInput)
    : "";

  useEffect(() => {
    if (!form.image) {
      setImagePreviewUrl("");
      return;
    }
    let aborted = false;
    resolveImage(form.image)
      .then((resolved) => {
        if (!aborted) {
          setImagePreviewUrl(resolved.url);
        }
      })
      .catch(() => {
        if (!aborted) setImagePreviewUrl("");
      });
    return () => {
      aborted = true;
    };
  }, [form.image]);

  const shareUrl = useMemo(() => buildShareUrl(form), [form]);
  const searchParams = useMemo(() => buildSearchParams(form), [form]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = searchParams.toString();
    window.history.replaceState(null, "", url.toString());
  }, [searchParams]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
      setCopyStatus("error");
    }
  };

  const handleOpen = () => {
    window.location.href = shareUrl;
  };

  const updateField =
    (field: keyof EditorForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleLocalTimeChange = (date: Date | null) => {
    setLocalTimeInput(date);
    if (date) {
      setForm((prev) => ({ ...prev, time: date.toISOString() }));
    } else {
      setForm((prev) => ({ ...prev, time: "" }));
    }
  };

  const handlePresetSelect = (preset: TimePreset) => {
    const nextDate = preset.compute(new Date());
    handleLocalTimeChange(nextDate);
  };

  const handleThemeSelect = (key: string) => {
    if (key === "custom") return;
    const theme = themeMap.get(key);
    if (!theme) return;
    setForm((prev) => ({
      ...prev,
      bgcolor: theme.background,
      color: theme.text,
      themeKey: key,
    }));
  };

  const { lightThemes, darkThemes } = useMemo(() => {
    return themes.reduce(
      (acc, theme) => {
        if (isLightBackground(theme.background)) {
          acc.lightThemes.push(theme);
        } else {
          acc.darkThemes.push(theme);
        }
        return acc;
      },
      { lightThemes: [] as typeof themes, darkThemes: [] as typeof themes },
    );
  }, []);

  const handleSearch = async () => {
    if (!form.imageInput.trim()) return;
    setIsSearching(true);
    setImageError("");
    setNextOvPage(null);
    setNextTenorPos(null);
    try {
      const [ov, tn] = await Promise.allSettled([
        searchOpenverse(form.imageInput.trim(), 1, 9),
        searchTenor(form.imageInput.trim(), "", 9, "high"),
      ]);
      const results: SearchResult[] = [];
      if (ov.status === "fulfilled") {
        results.push(...ov.value.results);
        setNextOvPage(ov.value.nextPage);
      }
      if (tn.status == "fulfilled") {
        results.push(...tn.value.results);
        setNextTenorPos(tn.value.next);
      }
      const unique = dedupeResults(results);
      setImageResults(unique);
      if (!results.length) setImageError("No results found");
    } catch (error) {
      console.warn("Image search failed", error);
      setImageError("Search failed. Check API keys or try again.");
      setImageResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewMore = async () => {
    if (!form.imageInput.trim()) return;
    if (!nextOvPage && !nextTenorPos) return;
    setIsSearching(true);
    setImageError("");
    try {
      type OpenverseSearchResult = ReturnType<typeof searchOpenverse>;
      type TenorSearchResult = ReturnType<typeof searchTenor>;
      const tasks: (OpenverseSearchResult | TenorSearchResult)[] = [];
      if (nextOvPage)
        tasks.push(searchOpenverse(form.imageInput.trim(), nextOvPage, 9));
      if (nextTenorPos)
        tasks.push(
          searchTenor(form.imageInput.trim(), nextTenorPos, 9, "high"),
        );
      const settled = await Promise.allSettled(tasks);
      let extra: SearchResult[] = [];
      let nextPage: number | null = nextOvPage;
      let nextPos: string | null = nextTenorPos;
      for (const result of settled) {
        if (result.status === "fulfilled") {
          if ("nextPage" in result.value) nextPage = result.value.nextPage;
          if ("next" in result.value) nextPos = result.value.next;
          extra = extra.concat(result.value.results || []);
        }
      }
      setNextOvPage(nextPage);
      setNextTenorPos(nextPos);

      setImageResults((prev) => {
        const combined = dedupeResults([...prev, ...extra]);
        if (!combined.length) {
          setImageError("No results found");
        } else {
          setImageError("");
        }
        return combined;
      });
    } catch (error) {
      console.warn("Image search failed", error);
      setImageError("Search failed. Check API keys or try again.");
      setImageResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  const handleSelectImage = async (id: string) => {
    setForm((prev) => ({ ...prev, image: id }));
    const selected = imageResults.find((item) => item.id === id);
    if (selected?.thumb) {
      setImagePreviewUrl(selected.thumb);
    }
    try {
      const resolved = await resolveImage(id);
      setImagePreviewUrl(resolved.url);
    } catch (error) {
      console.warn("Resolve failed", error);
      if (!selected?.thumb) {
        setImagePreviewUrl("");
      }
    }
  };

  const handleClearImage = () => {
    setForm((prev) => ({ ...prev, image: "", imageInput: "" }));
    setImagePreviewUrl("");
    setImageResults([]);
    setNextOvPage(null);
    setNextTenorPos(null);
    setImageError("");
  };

  useEffect(() => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = undefined;
    }
    if (!form.imageInput.trim()) {
      return;
    }
    searchDebounceRef.current = window.setTimeout(() => {
      handleSearch();
    }, 350);
    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = undefined;
      }
    };
  }, [form.imageInput]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 text-left">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Editor
          </p>
          <h1 className="text-2xl font-semibold">Customize your countdown</h1>
        </div>
        <nav className="flex items-center gap-3">
          <button
            className="inline-flex items-center rounded-md px-2.5 py-2 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={handleOpen}
            title="View countdown"
            disabled={hasTimeError}
          >
            View
          </button>
          <a
            className="inline-flex items-center rounded-md px-2.5 py-2 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="https://github.com/obartra/countdown"
            title="Learn more..."
            target="_blank"
            rel="noreferrer"
          >
            <svg
              className="header-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 496 512"
              style={{ fill: "white" }}
            >
              <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
            </svg>
          </a>
        </nav>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit the query parameters and share the generated link.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <ReactDatePicker
                id="time"
                selected={localTimeInput}
                onChange={handleLocalTimeChange}
                showTimeSelect
                timeIntervals={5}
                dateFormat="yyyy-MM-dd HH:mm"
                placeholderText="Pick a date and time"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-describedby="time-helper-text"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick presets
                </span>
                {timePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <p
                id="time-helper-text"
                className="text-xs text-muted-foreground"
              >
                We convert your local time to UTC automatically.
              </p>
              {hasTimeError ? (
                <div className="text-sm text-destructive">
                  Enter a valid date/time.
                </div>
              ) : (
                <div className="rounded-lg border border-input bg-muted/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Time summary
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {timeZoneName}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <dt className="text-xs uppercase text-muted-foreground">
                        UTC
                      </dt>
                      <dd>
                        <code className="rounded bg-background px-2 py-1 font-mono text-xs">
                          {interpretedUtc}
                        </code>
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <dt className="text-xs uppercase text-muted-foreground">
                        Local
                      </dt>
                      <dd className="font-mono text-sm">{interpretedLocal}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={updateField("title")}
                  placeholder="Launch day"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complete">Complete text</Label>
                <Input
                  id="complete"
                  value={form.completeText}
                  onChange={updateField("completeText")}
                  placeholder="Time is up!"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={updateField("description")}
                  placeholder="Smaller text below the countdown"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="footer">Footer</Label>
                <Textarea
                  id="footer"
                  value={form.footer}
                  onChange={updateField("footer")}
                  placeholder="Footer text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Dark
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {darkThemes.map((theme) => {
                      const isSelected =
                        form.themeKey === theme.key && !colors.isCustomTheme;
                      return (
                        <button
                          key={theme.key}
                          type="button"
                          onClick={() => handleThemeSelect(theme.key)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                            isSelected
                              ? "border-primary ring-1 ring-primary"
                              : "border-input"
                          }`}
                          data-testid={`theme-${theme.key}`}
                        >
                          <div>
                            <div className="text-sm font-semibold capitalize">
                              {theme.key.replace(/-/g, " ")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {theme.background} / {theme.text}
                            </div>
                          </div>
                          <span
                            className="h-10 w-10 rounded-md border"
                            style={{
                              background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.text} 50%)`,
                              borderColor: "rgba(255,255,255,0.1)",
                            }}
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Light
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {lightThemes.map((theme) => {
                      const isSelected =
                        form.themeKey === theme.key && !colors.isCustomTheme;
                      return (
                        <button
                          key={theme.key}
                          type="button"
                          onClick={() => handleThemeSelect(theme.key)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                            isSelected
                              ? "border-primary ring-1 ring-primary"
                              : "border-input"
                          }`}
                          data-testid={`theme-${theme.key}`}
                        >
                          <div>
                            <div className="text-sm font-semibold capitalize">
                              {theme.key.replace(/-/g, " ")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {theme.background} / {theme.text}
                            </div>
                          </div>
                          <span
                            className="h-10 w-10 rounded-md border"
                            style={{
                              background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.text} 50%)`,
                              borderColor: "rgba(255,255,255,0.1)",
                            }}
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {colors.isCustomTheme || form.themeKey === "custom" ? (
                  <div
                    className="flex items-center justify-between rounded-lg border border-dashed border-primary px-3 py-2 text-left"
                    data-testid="theme-custom"
                    aria-label="Custom colors"
                  >
                    <div>
                      <div className="text-sm font-semibold">Custom colors</div>
                      <div className="text-xs text-muted-foreground">
                        {form.bgcolor} / {form.color}
                      </div>
                    </div>
                    <span
                      className="h-10 w-10 rounded-md border"
                      style={{
                        background: `linear-gradient(135deg, ${form.bgcolor} 50%, ${form.color} 50%)`,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                      aria-hidden
                    />
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Themes set both background and text colors. URLs still include
                `bgcolor` and `color`.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="image-search">Image search</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="image-search"
                    value={form.imageInput}
                    onChange={updateField("imageInput")}
                    placeholder="Search stickers or SVGs"
                    className="w-full pr-10"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                      }
                    }}
                  />
                  {form.imageInput || form.image ? (
                    <button
                      type="button"
                      aria-label="Clear search and image"
                      onClick={handleClearImage}
                      className="absolute inset-y-0 right-2 flex items-center text-lg leading-none text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      ❌
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageResults.map((result) => {
                  const isSelected = form.image === result.id;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectImage(result.id)}
                      className={`flex flex-col overflow-hidden rounded-lg border text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        isSelected
                          ? "border-primary ring-1 ring-primary"
                          : "border-input"
                      }`}
                      data-testid={`image-result-${result.id}`}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        {result.thumb ? (
                          <img
                            src={result.thumb}
                            alt={result.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No preview
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1">
                        <div className="text-xs font-semibold">
                          {result.title}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {result.provider}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {(nextOvPage || nextTenorPos) && imageResults.length ? (
                <div className="flex justify-start pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleViewMore}
                    disabled={isSearching}
                  >
                    View more
                  </Button>
                </div>
              ) : null}
              {imageError ? (
                <p className="text-xs text-destructive">{imageError}</p>
              ) : null}
            </div>
            {imagePreviewUrl ? (
              <div className="rounded-lg border border-input bg-muted/30 p-3">
                <div
                  data-testid="selected-image-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Selected image
                </div>
                <div className="mt-2 flex justify-center">
                  <img
                    src={imagePreviewUrl}
                    alt={form.image}
                    className="max-h-40 max-w-40 object-contain"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground break-all">
                  {form.image}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={handleCopy}
                disabled={hasTimeError}
              >
                Copy shareable link
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleOpen}
                disabled={hasTimeError}
              >
                Open countdown
              </Button>
              <span className="text-sm text-muted-foreground">
                {copyStatus === "copied"
                  ? "Copied!"
                  : copyStatus === "error"
                    ? "Clipboard unavailable, copy manually."
                    : shareUrl}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Live view using the current parameters.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-2xl p-6 text-center shadow-sm"
              style={{
                backgroundColor: previewParams.backgroundColor,
                color: previewParams.textColor,
              }}
            >
              {countdownState === "helper" ? (
                <Alert variant="warning" className="mx-auto max-w-xl text-left">
                  <AlertTitle>Time is required</AlertTitle>
                  <AlertDescription>
                    Enter a valid ISO UTC time to start the countdown.
                  </AlertDescription>
                </Alert>
              ) : null}

              {countdownState === "countdown" ? (
                <div className="space-y-2">
                  {previewParams.title ? (
                    <h3 className="text-xl font-semibold">
                      {previewParams.title}
                    </h3>
                  ) : null}
                  <div className="font-mono text-5xl font-semibold leading-tight sm:text-6xl">
                    {countdownLabel}
                  </div>
                  <div className="text-sm font-medium">
                    Time until <span>{endDateText}</span> (
                    <span>{timeZoneName}</span>)
                  </div>
                </div>
              ) : null}

              {countdownState === "complete" ? (
                <div className="text-3xl font-semibold">
                  {previewParams.completeText}
                </div>
              ) : null}

              {imagePreviewUrl ? (
                <div className="mt-4 flex justify-center">
                  <img
                    src={imagePreviewUrl}
                    alt={previewParams.image}
                    className="emoji-image"
                  />
                </div>
              ) : null}

              {previewParams.description && countdownState !== "helper" ? (
                <p className="mt-4 text-base text-muted-foreground">
                  {previewParams.description}
                </p>
              ) : null}

              {previewParams.footer && countdownState !== "helper" ? (
                <p className="mt-4 text-sm font-medium">
                  {previewParams.footer}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditPage;
