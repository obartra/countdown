import React, { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { CountdownGrid } from "./ui/countdown-grid";
import { CountdownFooter } from "./ui/countdown-footer";
import { DescriptionBlock } from "./ui/description-block";
import { ImageDisplay } from "./ui/image-display";
import { useImageMaxHeight } from "../hooks/useImageMaxHeight";
import { cn } from "../lib/utils";
import {
  CountdownDisplay,
  CountdownParams,
  CountdownState,
  dateFormatter,
} from "../countdown";
import {
  parseImageId,
  resolveImage,
  type ResolvedImage,
} from "../imageResolver";
import { Card, CardHeader, CardTitle } from "./ui/card";

type HelperAlert = {
  title: string;
  description: string;
};

type CountdownPreviewProps = {
  params: CountdownParams;
  state: CountdownState;
  countdownDisplay: CountdownDisplay;
  targetDate: Date | null;
  helperAlert?: HelperAlert;
  className?: string;
  reportAction?: {
    onClick: () => void;
    label?: string;
  };
};

const CountdownPreview = ({
  params,
  state,
  countdownDisplay,
  targetDate,
  helperAlert,
  className,
  reportAction,
}: CountdownPreviewProps) => {
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
      return () => {
        aborted = true;
      };
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
  }, [parsedImage]);

  const showHelper = state === "helper";
  const showCountdown = state === "countdown";
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

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
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
  const endDateText = targetDate ? dateFormatter(targetDate) : "";
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

  const helperAlertContent =
    showHelper && helperAlert ? (
      <Alert variant="warning" className="mx-auto max-w-xl text-left">
        <AlertTitle>{helperAlert.title}</AlertTitle>
        <AlertDescription>{helperAlert.description}</AlertDescription>
      </Alert>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn("flex w-full flex-1 flex-col gap-4", className)}
    >
      {helperAlertContent}
      <div
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
      </div>

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

      <DescriptionBlock
        show={showDescription}
        description={params.description}
        descriptionRef={descriptionRef}
      />

      <ImageDisplay
        showImage={showImage}
        imageUrl={displayImageUrl}
        imageAlt={imageAlt}
        imageError={imageError}
        imageContainerRef={imageContainerRef}
        imageMaxHeightPx={imageMaxHeightPx}
        handleImageLoad={handleImageLoad}
      />

      <CountdownFooter
        showFooter={showFooter}
        footerText={params.footer}
        resolvedImage={resolvedImage}
        footerRef={footerRef}
        reportAction={reportAction}
      />
    </div>
  );
};

export default CountdownPreview;
