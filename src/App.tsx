import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "./components/ui/card";
import { CountdownFooter } from "./components/ui/countdown-footer";
import { CountdownGrid } from "./components/ui/countdown-grid";
import { CountdownHeader } from "./components/ui/countdown-header";
import { DescriptionBlock } from "./components/ui/description-block";
import { HelperForm } from "./components/ui/helper-form";
import { ImageDisplay } from "./components/ui/image-display";
import {
  CountdownProvider,
  useCountdownContext,
} from "./context/countdownContext";
import { useCountdownViewModel } from "./hooks/useCountdownViewModel";
import { useImageMaxHeight } from "./hooks/useImageMaxHeight";
import {
  parseImageId,
  resolveImage,
  type ResolvedImage,
} from "./imageResolver";
import { CountdownParams, dateFormatter } from "./countdown";

type AppProps = {
  initialParams?: CountdownParams;
};

const AppContent = () => {
  const {
    params,
    state,
    helperValue,
    setHelperValue,
    helperError,
    setHelperError,
    countdownDisplay,
    targetDate,
    handleHelperSubmit,
    onPrefill,
  } = useCountdownContext();

  const [resolvedImage, setResolvedImage] = useState<ResolvedImage | null>(
    null,
  );
  const [imageError, setImageError] = useState<string>("");
  const parsedImage = useMemo(
    () => (params.image ? parseImageId(params.image) : null),
    [params.image],
  );

  useEffect(() => {
    let aborted = false;
    if (!parsedImage) {
      setResolvedImage(null);
      setImageError("");
      return undefined;
    }

    const resolve = async () => {
      try {
        const result = await resolveImage(
          `${parsedImage.provider}:${parsedImage.id}`,
        );
        if (!aborted) {
          setResolvedImage(result);
          setImageError("");
        }
      } catch (error) {
        if (!aborted) {
          console.warn("Failed to resolve image", error);
          setResolvedImage(null);
          setImageError("Unable to load image");
        }
      }
    };

    resolve();
    return () => {
      aborted = true;
    };
  }, [params.image]);

  const endDateText = targetDate ? dateFormatter(targetDate) : "";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const showCountdown = state === "countdown";
  const showHelper = state === "helper";
  const showComplete = state === "complete";
  const displayImageUrl = resolvedImage?.url || "";
  const showImage = Boolean(displayImageUrl) && !showHelper;
  const showDescription =
    Boolean(params.description) && !showHelper && !showComplete;
  const showFooter = Boolean(params.footer) && !showComplete && !showHelper;
  const imageAlt = resolvedImage?.alt || params.image;

  const {
    rootRef,
    imageContainerRef,
    descriptionRef,
    footerRef,
    imageMaxHeightPx,
    handleImageLoad,
  } = useImageMaxHeight({
    showImage,
    showDescription,
    showFooter,
    resolvedImage,
  });

  const tzFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone,
        timeZoneName: "short",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [timeZone],
  );

  const endDateDisplay = useMemo(() => {
    if (!targetDate) return "";
    return tzFormatter.format(targetDate);
  }, [targetDate, tzFormatter]);

  const timeZoneNameLong = useMemo(() => {
    if (!targetDate) return "";
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: "long",
    }).formatToParts(targetDate);
    const tzPart = parts.find((part) => part.type === "timeZoneName");
    return tzPart?.value ?? timeZone;
  }, [targetDate, timeZone]);

  const offsetString = useMemo(() => {
    if (!targetDate) return "";
    const offsetMinutes = targetDate.getTimezoneOffset();
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, "0");
    const minutes = String(abs % 60).padStart(2, "0");
    return `UTC${sign}${hours}:${minutes}`;
  }, [targetDate]);

  const countdownParts = countdownDisplay.parts || {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  const visibleCountdownParts = useMemo(() => {
    const parts = [
      { label: "Days", raw: countdownParts.days, key: "days" as const },
      { label: "Hours", raw: countdownParts.hours, key: "hours" as const },
      {
        label: "Minutes",
        raw: countdownParts.minutes,
        key: "minutes" as const,
      },
      {
        label: "Seconds",
        raw: countdownParts.seconds,
        key: "seconds" as const,
      },
    ];

    while (parts.length > 1 && parts[0].raw === 0) {
      parts.shift();
    }

    return parts.map((part) => ({
      label: part.label,
      value:
        part.key === "days"
          ? part.raw.toString()
          : part.raw.toString().padStart(2, "0"),
      key: part.key,
    }));
  }, [
    countdownParts.days,
    countdownParts.hours,
    countdownParts.minutes,
    countdownParts.seconds,
  ]);

  const attributionBackground = useMemo(() => {
    const color = params.textColor;
    const hex = color.startsWith("#") ? color.slice(1) : null;
    if (hex && (hex.length === 6 || hex.length === 3)) {
      const normalized =
        hex.length === 3
          ? hex
              .split("")
              .map((c) => c + c)
              .join("")
          : hex;
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)";
    }
    return "rgba(0,0,0,0.12)";
  }, [params.textColor]);

  return (
    <div
      ref={rootRef}
      className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 text-center"
    >
      <CountdownHeader title={params.title} textColor={params.textColor} />

      <HelperForm
        show={showHelper}
        helperValue={helperValue}
        setHelperValue={setHelperValue}
        helperError={helperError}
        setHelperError={setHelperError}
        onPrefill={onPrefill}
        onSubmit={handleHelperSubmit}
      />

      <main
        className="space-y-2"
        style={{ display: showCountdown ? undefined : "none" }}
      >
        <CountdownGrid
          parts={visibleCountdownParts}
          endDateDisplay={endDateDisplay || endDateText}
          timeZoneNameLong={timeZoneNameLong}
          offsetString={offsetString}
          showCountdown={showCountdown}
        />
      </main>

      <section
        id="complete-container"
        style={{ display: showComplete ? undefined : "none" }}
        className="px-3"
      >
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="p-0">
            <CardTitle
              className="text-4xl font-semibold"
              style={{ color: params.textColor }}
            >
              <div id="complete-text">{params.completeText}</div>
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <ImageDisplay
        showImage={showImage}
        imageUrl={displayImageUrl}
        imageAlt={imageAlt}
        imageError={imageError}
        imageContainerRef={imageContainerRef}
        imageMaxHeightPx={imageMaxHeightPx}
        handleImageLoad={handleImageLoad}
      />

      <DescriptionBlock
        show={showDescription}
        description={params.description}
        descriptionRef={descriptionRef}
      />

      <CountdownFooter
        showFooter={showFooter}
        footerText={params.footer}
        resolvedImage={resolvedImage}
        attributionBackground={attributionBackground}
        textColor={params.textColor}
        footerRef={footerRef}
      />
    </div>
  );
};

const App = ({ initialParams }: AppProps) => {
  const viewModel = useCountdownViewModel(initialParams);

  return (
    <CountdownProvider value={viewModel}>
      <AppContent />
    </CountdownProvider>
  );
};

export default App;
