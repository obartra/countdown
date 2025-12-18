import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { normalizeSlugInput } from "./lib/slug";
import { formatRelativeExpiry } from "./lib/formatRelativeExpiry";
import { createThemeCssVars, resolveThemeTokens } from "./lib/themeCssVars";
import { Textarea } from "./components/ui/textarea";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DEFAULT_THEME_KEY, themeMap, themes } from "./themes";
import {
  CountdownDisplay,
  CountdownParams,
  CountdownState,
  DEFAULT_COMPLETE_TEXT,
  deriveColors,
  deriveCountdownMeta,
  formatCountdown,
  parseParamsFromSearch,
} from "./countdown";
import CountdownPreview from "./components/CountdownPreview";
import { resolveImage } from "./imageResolver";
import { searchOpenverse, searchTenor, type SearchResult } from "./imageSearch";
import {
  buildCanonicalCountdownSearchParams,
  buildOverrideCountdownSearchParams,
  mergeCanonicalCountdownSearchParams,
} from "./countdownUrl";
import { ShareLinkActions } from "./components/ShareLinkActions";

const defaultCountdownDisplay: CountdownDisplay = {
  label: "",
  totalMs: 0,
  parts: {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  },
};

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

type PublishStatus = "idle" | "pending" | "success" | "error";
type DeleteStatus = "idle" | "pending" | "success" | "error";

type PublishResult = {
  slug: string;
  shortUrl: string;
  longUrl: string;
  expiresAt: number;
  requiresPassword: boolean;
};

type PublishedEditContext = {
  slug: string;
  expiresAt?: number;
  requiresPassword: boolean;
};

const buildShareUrl = (search: URLSearchParams) => {
  const url = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  url.search = search.toString();
  return url.toString();
};

type EditPageProps = {
  initialParams?: CountdownParams;
  publishedContext?: PublishedEditContext | null;
  publishedDefaultsSearch?: string;
};

const toLocalDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

type OwnerUnlockStatus = "idle" | "pending" | "success" | "error";

const EditPage = ({
  initialParams,
  publishedContext,
  publishedDefaultsSearch,
}: EditPageProps) => {
  const params = useMemo(
    () => initialParams ?? parseParamsFromSearch(window.location.search),
    [initialParams],
  );

  const [form, setForm] = useState<EditorForm>({
    time: params.rawTime,
    title: params.title || "",
    description: params.description || "",
    footer: params.footer || "",
    completeText: params.completeText || DEFAULT_COMPLETE_TEXT,
    image: params.image || "",
    bgcolor: params.backgroundColorInput || "",
    color: params.textColorInput || "",
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
  const [countdownDisplay, setCountdownDisplay] = useState<CountdownDisplay>(
    defaultCountdownDisplay,
  );
  const [miniAspectRatio, setMiniAspectRatio] = useState(() => {
    if (typeof window === "undefined" || window.innerHeight === 0) {
      return 1;
    }
    return window.innerWidth / window.innerHeight;
  });
  const [showMiniPreview, setShowMiniPreview] = useState(false);
  const [imageResults, setImageResults] = useState<SearchResult[]>([]);
  const [nextOvPage, setNextOvPage] = useState<number | null>(null);
  const [nextTenorPos, setNextTenorPos] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [customSlugInput, setCustomSlugInput] = useState("");
  const [publishPasswordInput, setPublishPasswordInput] = useState("");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(
    null,
  );
  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [ownerUnlockStatus, setOwnerUnlockStatus] =
    useState<OwnerUnlockStatus>("idle");
  const [ownerUnlockMessage, setOwnerUnlockMessage] = useState<string | null>(
    null,
  );
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("idle");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const ownerPasswordRef = useRef<string | null>(null);
  const [slugDefaultsSearch, setSlugDefaultsSearch] = useState<string | null>(
    publishedDefaultsSearch ? publishedDefaultsSearch.replace(/^\?/, "") : null,
  );
  const searchDebounceRef = useRef<number | undefined>();
  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const publishedSlugRef = useRef<string | null>(null);

  const publishedSlug = publishedContext?.slug ?? null;
  const publishedRequiresPassword = Boolean(publishedContext?.requiresPassword);

  const colors = useMemo(
    () => deriveColors(form.bgcolor || null, form.color || null),
    [form.bgcolor, form.color],
  );

  const countdownQueryInput = useMemo(
    () => ({
      time: form.time,
      title: form.title,
      description: form.description,
      footer: form.footer,
      complete: form.completeText,
      image: form.image,
      bgcolor: form.bgcolor,
      color: form.color,
    }),
    [form],
  );

  const canonicalCountdownSearchParams = useMemo(
    () => buildCanonicalCountdownSearchParams(countdownQueryInput),
    [countdownQueryInput],
  );
  const canonicalCountdownSearch = canonicalCountdownSearchParams.toString();
  const normalizedCustomSlug = customSlugInput
    ? normalizeSlugInput(customSlugInput)
    : null;
  const slugValidationMessage =
    customSlugInput && !normalizedCustomSlug
      ? "Slugs must be 3-48 lowercase letters/numbers with optional single hyphens."
      : null;

  const previewParams: CountdownParams = useMemo(
    () => parseParamsFromSearch(canonicalCountdownSearch),
    [canonicalCountdownSearch],
  );
  const previewThemeTokens = useMemo(
    () =>
      resolveThemeTokens({
        backgroundColor: previewParams.backgroundColor,
        textColor: previewParams.textColor,
        themeKey: previewParams.themeKey,
      }),
    [
      previewParams.backgroundColor,
      previewParams.textColor,
      previewParams.themeKey,
    ],
  );
  const previewThemeVars = useMemo(
    () => createThemeCssVars(previewThemeTokens),
    [previewThemeTokens],
  );

  const { targetDate, state: metaState } = useMemo(
    () => deriveCountdownMeta(previewParams),
    [previewParams],
  );

  useEffect(() => {
    setCountdownState(metaState);
    if (metaState === "countdown" && targetDate) {
      setCountdownDisplay(formatCountdown(targetDate.getTime() - Date.now()));
    } else {
      setCountdownDisplay(defaultCountdownDisplay);
    }
  }, [canonicalCountdownSearch, metaState, targetDate]);

  useEffect(() => {
    if (countdownState !== "countdown" || !targetDate) {
      return undefined;
    }

    const tick = () => {
      const remaining = targetDate.getTime() - Date.now();
      if (remaining <= 0) {
        setCountdownState("complete");
        setCountdownDisplay(defaultCountdownDisplay);
        return;
      }
      setCountdownDisplay(formatCountdown(remaining));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdownState, targetDate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateRatio = () => {
      if (window.innerHeight === 0) {
        setMiniAspectRatio(1);
        return;
      }
      setMiniAspectRatio(window.innerWidth / window.innerHeight);
    };
    updateRatio();
    window.addEventListener("resize", updateRatio);
    return () => window.removeEventListener("resize", updateRatio);
  }, []);

  useEffect(() => {
    const node = previewCardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowMiniPreview(!entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hasTimeError = !localTimeInput;

  useEffect(() => {
    if (!previewParams.image) {
      setImagePreviewUrl("");
      return;
    }
    let aborted = false;
    resolveImage(previewParams.image)
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
  }, [previewParams.image]);

  const initialSearchRef = useRef(
    typeof window !== "undefined" ? window.location.search : "",
  );

  const editorSearchParams = useMemo(() => {
    if (slugDefaultsSearch) {
      return buildOverrideCountdownSearchParams(
        slugDefaultsSearch,
        countdownQueryInput,
        initialSearchRef.current,
      );
    }
    return mergeCanonicalCountdownSearchParams(
      initialSearchRef.current,
      countdownQueryInput,
    );
  }, [countdownQueryInput, slugDefaultsSearch]);
  const editorSearchString = editorSearchParams.toString();
  const shareUrl = useMemo(
    () => buildShareUrl(canonicalCountdownSearchParams),
    [canonicalCountdownSearch],
  );

  const helperAlert = {
    title: "Time is required",
    description: "Enter a valid ISO UTC time to start the countdown.",
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = editorSearchString;
    window.history.replaceState(null, "", url.toString());
  }, [editorSearchString]);

  useEffect(() => {
    if (!publishedDefaultsSearch) {
      setSlugDefaultsSearch(null);
      return;
    }
    setSlugDefaultsSearch(publishedDefaultsSearch.replace(/^\?/, ""));
  }, [publishedDefaultsSearch]);

  const handleOpen = () => {
    if (publishedSlug) {
      window.location.href = new URL(
        `${import.meta.env.BASE_URL}v/${publishedSlug}`,
        window.location.origin,
      ).toString();
      return;
    }
    window.location.href = shareUrl;
  };

  const safeParseJson = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!publishedContext) return;
    if (publishedSlugRef.current === publishedContext.slug) return;
    publishedSlugRef.current = publishedContext.slug;

    setCustomSlugInput(publishedContext.slug);
    setPublishResult({
      slug: publishedContext.slug,
      shortUrl: new URL(
        `${import.meta.env.BASE_URL}v/${publishedContext.slug}`,
        window.location.origin,
      ).toString(),
      longUrl: "",
      expiresAt: publishedContext.expiresAt ?? Date.now(),
      requiresPassword: publishedContext.requiresPassword,
    });
    setPublishStatus("success");
    setPublishMessage(null);
    setDeleteStatus("idle");
    setDeleteMessage(null);
    setDeleteConfirmInput("");
    setPublishPasswordInput("");
    setOwnerPasswordInput("");
    setOwnerUnlockStatus("idle");
    setOwnerUnlockMessage(null);
    setIsOwnerUnlocked(!publishedContext.requiresPassword);
    ownerPasswordRef.current = null;
  }, [publishedContext]);

  const handleOwnerUnlock = async () => {
    if (!publishedSlug) return;
    if (!ownerPasswordInput.trim()) {
      setOwnerUnlockStatus("error");
      setOwnerUnlockMessage("Password required to unlock editing.");
      return;
    }

    setOwnerUnlockStatus("pending");
    setOwnerUnlockMessage(null);

    try {
      const response = await fetch(
        `/api/published/${publishedSlug}?action=verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: ownerPasswordInput }),
        },
      );
      const text = await response.text();
      const parsed = safeParseJson(text) as { error?: string } | null;

      if (!response.ok) {
        setOwnerUnlockStatus("error");
        setOwnerUnlockMessage(
          parsed?.error ||
            "Unable to unlock. Check your password and try again.",
        );
        return;
      }

      setOwnerUnlockStatus("success");
      setOwnerUnlockMessage("Unlocked.");
      setIsOwnerUnlocked(true);
      setPublishPasswordInput(ownerPasswordInput);
      ownerPasswordRef.current = ownerPasswordInput;
    } catch (error) {
      console.warn("Unlock failed", error);
      setOwnerUnlockStatus("error");
      setOwnerUnlockMessage("Unable to unlock. Try again.");
    }
  };

  const handlePublish = async () => {
    if (hasTimeError) {
      setPublishStatus("error");
      setPublishMessage("Enter a valid time before publishing.");
      return;
    }

    const normalizedSlug = customSlugInput
      ? normalizeSlugInput(customSlugInput)
      : null;

    if (customSlugInput && !normalizedSlug) {
      setPublishStatus("error");
      setPublishMessage(
        "Slug must be 3-48 lowercase letters/numbers with optional hyphens.",
      );
      return;
    }

    const publishPassword =
      normalizedSlug && publishedSlug && normalizedSlug === publishedSlug
        ? publishPasswordInput || ownerPasswordRef.current
        : publishPasswordInput;

    if (normalizedSlug && !publishPassword) {
      setPublishStatus("error");
      setPublishMessage("Password required for a custom slug.");
      return;
    }

    setPublishStatus("pending");
    setPublishMessage(null);

    const payload = {
      canonicalSearch: canonicalCountdownSearch,
      ...(normalizedSlug
        ? { slug: normalizedSlug, password: publishPassword }
        : {}),
    };

    try {
      const response = await fetch("/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      const parsed = safeParseJson(text) as {
        slug?: string;
        shortUrl?: string;
        longUrl?: string;
        expiresAt?: number;
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        const message =
          parsed?.error ||
          parsed?.message ||
          "Unable to publish the countdown.";
        setPublishStatus("error");
        setPublishMessage(message);
        return;
      }

      if (!parsed?.slug || !parsed?.shortUrl) {
        setPublishStatus("error");
        setPublishMessage("Publish succeeded but the response was malformed.");
        return;
      }

      const result: PublishResult = {
        slug: parsed.slug,
        shortUrl: new URL(
          `${import.meta.env.BASE_URL}v/${parsed.slug}`,
          window.location.origin,
        ).toString(),
        longUrl: parsed.longUrl ?? shareUrl,
        expiresAt: parsed.expiresAt ?? Date.now(),
        requiresPassword: Boolean(normalizedSlug),
      };

      if (normalizedSlug && publishPasswordInput) {
        ownerPasswordRef.current = publishPasswordInput;
      }

      setPublishResult(result);
      setPublishStatus("success");
      setCustomSlugInput(result.slug);
      setPublishPasswordInput("");
      setDeleteConfirmInput("");
      setDeleteStatus("idle");
      setDeleteMessage(null);

      if (publishedSlug && result.slug === publishedSlug) {
        setSlugDefaultsSearch(canonicalCountdownSearch);
      }
    } catch (error) {
      console.warn("Publish failed", error);
      setPublishStatus("error");
      setPublishMessage("Unable to publish the countdown. Try again.");
    }
  };

  const handleDelete = async () => {
    if (!publishResult) return;
    const confirmationMatches =
      deleteConfirmInput.trim().toLowerCase() === publishResult.slug;

    if (!confirmationMatches) {
      setDeleteStatus("error");
      setDeleteMessage("Type the slug to confirm deletion.");
      return;
    }

    const password = publishResult.requiresPassword
      ? ownerPasswordRef.current
      : null;

    if (publishResult.requiresPassword && !password) {
      setDeleteStatus("error");
      setDeleteMessage("Unlock with the owner password to delete this slug.");
      return;
    }

    setDeleteStatus("pending");
    setDeleteMessage(null);

    const payload = publishResult.requiresPassword ? { password } : undefined;

    try {
      const response = await fetch(`/api/published/${publishResult.slug}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload ?? {}),
      });
      const text = await response.text();
      const parsed = safeParseJson(text) as {
        error?: string;
      } | null;

      if (!response.ok) {
        const message = parsed?.error || "Unable to delete the published slug.";
        setDeleteStatus("error");
        setDeleteMessage(message);
        return;
      }

      setDeleteStatus("success");
      setDeleteMessage("Published slug removed.");
      setPublishResult(null);
      setPublishStatus("idle");
      setPublishMessage(null);
      setCustomSlugInput("");
      setPublishPasswordInput("");
      setDeleteConfirmInput("");
    } catch (error) {
      console.warn("Delete slug failed", error);
      setDeleteStatus("error");
      setDeleteMessage("Unable to delete the published slug.");
    }
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

  const showOwnerGate =
    publishedSlug && publishedRequiresPassword && !isOwnerUnlocked;

  const deleteConfirmationMatches = publishResult
    ? deleteConfirmInput.trim().toLowerCase() === publishResult.slug
    : false;

  if (showOwnerGate) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-6 text-left">
        <Card>
          <CardHeader>
            <CardTitle>Owner access</CardTitle>
            <p className="text-sm text-muted-foreground">
              This countdown is password-protected. Enter the password to edit
              or delete it.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleOwnerUnlock();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="owner-password">Password</Label>
                <Input
                  id="owner-password"
                  type="password"
                  placeholder="Enter owner password"
                  value={ownerPasswordInput}
                  onChange={(event) =>
                    setOwnerPasswordInput(event.target.value)
                  }
                  disabled={ownerUnlockStatus === "pending"}
                />
              </div>
              <Button
                type="submit"
                disabled={
                  ownerUnlockStatus === "pending" || !ownerPasswordInput.trim()
                }
              >
                {ownerUnlockStatus === "pending" ? "Checking…" : "Edit"}
              </Button>
              {ownerUnlockStatus === "error" && ownerUnlockMessage ? (
                <p className="text-xs text-destructive">{ownerUnlockMessage}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 text-left">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-3">
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
          <button
            className="inline-flex items-center rounded-md px-2.5 py-2 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={handleOpen}
            title="View countdown"
            disabled={hasTimeError}
          >
            View
          </button>
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
              <Label htmlFor="time" className="mb-1 block">
                Time
              </Label>
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
              <div className="flex flex-wrap gap-2 pt-2">
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
              {hasTimeError ? (
                <div className="text-sm text-destructive">
                  Enter a valid date/time.
                </div>
              ) : null}
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
                        {previewParams.backgroundColor} /{" "}
                        {previewParams.textColor}
                      </div>
                    </div>
                    <span
                      className="h-10 w-10 rounded-md border"
                      style={{
                        background: `linear-gradient(135deg, ${previewParams.backgroundColor} 50%, ${previewParams.textColor} 50%)`,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                      aria-hidden
                    />
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Themes set both background and text colors. The URL only
                includes non-default overrides.
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
                    alt={previewParams.image ?? form.image}
                    className="max-h-40 max-w-40 object-contain"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground break-all">
                  {previewParams.image ?? form.image}
                </p>
              </div>
            ) : null}

            <section className="space-y-2 pt-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Share
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy or open the shareable link for this countdown.
                </p>
              </div>
              <ShareLinkActions
                url={shareUrl}
                onView={handleOpen}
                disabled={hasTimeError}
              />
            </section>
            <section className="space-y-4 pt-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Publish
                </div>
                <p className="text-xs text-muted-foreground">
                  Save this countdown to a short-lived slug that you can share
                  without the long query string.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="publish-slug"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Slug (optional)
                  </Label>
                  <Input
                    id="publish-slug"
                    placeholder="Leave blank for generated slug"
                    value={customSlugInput}
                    onChange={(event) => setCustomSlugInput(event.target.value)}
                    disabled={publishStatus === "pending"}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="publish-password"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Password
                  </Label>
                  <Input
                    id="publish-password"
                    type="password"
                    placeholder="Required for custom slug"
                    value={publishPasswordInput}
                    onChange={(event) =>
                      setPublishPasswordInput(event.target.value)
                    }
                    disabled={publishStatus === "pending"}
                  />
                </div>
              </div>
              {slugValidationMessage ? (
                <p className="text-xs text-destructive">
                  {slugValidationMessage}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={
                    hasTimeError ||
                    publishStatus === "pending" ||
                    Boolean(slugValidationMessage) ||
                    (customSlugInput &&
                      !publishPasswordInput &&
                      !(
                        publishedSlug &&
                        normalizedCustomSlug === publishedSlug &&
                        ownerPasswordRef.current
                      ))
                  }
                >
                  {publishStatus === "pending"
                    ? "Publishing…"
                    : "Publish short URL"}
                </Button>
                {publishStatus === "success" && publishResult ? (
                  <span className="text-xs text-muted-foreground">
                    Published as{" "}
                    <span className="font-semibold">{publishResult.slug}</span>.
                  </span>
                ) : null}
              </div>
              {publishStatus === "error" && publishMessage ? (
                <p className="text-xs text-destructive">{publishMessage}</p>
              ) : null}
              {publishResult ? (
                <div className="space-y-2 pt-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Short link
                    </div>
                    <ShareLinkActions
                      url={publishResult.shortUrl}
                      disabled={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      {publishResult.requiresPassword
                        ? formatRelativeExpiry(publishResult.expiresAt)
                        : "Expires in 30 days"}
                      {" · "}
                      Expires on{" "}
                      {new Date(publishResult.expiresAt).toLocaleDateString()}.
                    </p>
                  </div>
                  <div className="rounded-lg border border-destructive/60 bg-destructive/10 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-destructive">
                          Danger zone
                        </div>
                        <p className="text-xs text-destructive">
                          Deleting reclaims the slug immediately.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-1">
                      <Label
                        htmlFor="delete-confirm"
                        className="text-xs font-semibold text-destructive"
                      >
                        Type slug to confirm
                      </Label>
                      <Input
                        id="delete-confirm"
                        placeholder={publishResult.slug}
                        value={deleteConfirmInput}
                        onChange={(event) =>
                          setDeleteConfirmInput(event.target.value)
                        }
                        disabled={deleteStatus === "pending"}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDelete}
                        disabled={
                          deleteStatus === "pending" ||
                          !deleteConfirmationMatches
                        }
                      >
                        {deleteStatus === "pending"
                          ? "Deleting…"
                          : "Delete published slug"}
                      </Button>
                      {deleteStatus === "success" && deleteMessage ? (
                        <p className="text-xs text-muted-foreground">
                          {deleteMessage}
                        </p>
                      ) : deleteStatus === "error" && deleteMessage ? (
                        <p className="text-xs text-destructive">
                          {deleteMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </CardContent>
        </Card>

        <div>
          <div
            ref={previewCardRef}
            data-testid="full-preview-card"
            className="lg:sticky lg:top-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Live view using the current parameters.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  className="rounded-2xl px-6 py-8 text-left shadow-sm"
                  style={{
                    backgroundColor: previewParams.backgroundColor,
                    color: previewParams.textColor,
                    ...previewThemeVars,
                  }}
                >
                  {previewParams.title ? (
                    <h2
                      data-testid="preview-title"
                      className="mb-5 text-2xl font-semibold leading-tight"
                    >
                      {previewParams.title}
                    </h2>
                  ) : null}
                  <CountdownPreview
                    params={previewParams}
                    state={countdownState}
                    countdownDisplay={countdownDisplay}
                    targetDate={targetDate}
                    helperAlert={helperAlert}
                    className="text-left"
                    reportAction={{ onClick: () => {} }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showMiniPreview ? (
        <div
          data-testid="mini-preview"
          className="pointer-events-none fixed top-4 right-4 z-50 overflow-hidden rounded-2xl border border-border shadow-xl lg:hidden"
          aria-hidden="true"
          style={{
            width: "clamp(160px, 25vw, 240px)",
            aspectRatio: miniAspectRatio || 1,
            backgroundColor: previewParams.backgroundColor,
            color: previewParams.textColor,
            ...previewThemeVars,
          }}
        >
          <div className="h-full w-full overflow-hidden">
            <div
              className="h-full w-full px-6 py-8"
              style={{
                zoom: "0.65",
              }}
            >
              <CountdownPreview
                params={previewParams}
                state={countdownState}
                countdownDisplay={countdownDisplay}
                targetDate={targetDate}
                helperAlert={helperAlert}
                className="gap-3 text-left"
                reportAction={{ onClick: () => {} }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditPage;
