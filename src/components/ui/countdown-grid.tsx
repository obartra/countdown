import React from "react";

type CountdownPart = {
  label: string;
  value: string;
  key: string;
};

type CountdownGridProps = {
  parts: CountdownPart[];
  endDateDisplay: string;
  timeZoneNameLong: string;
  offsetString: string;
  showCountdown: boolean;
};

export const CountdownGrid = ({
  parts,
  endDateDisplay,
  timeZoneNameLong,
  offsetString,
  showCountdown,
}: CountdownGridProps) => {
  return (
    <div
      className="space-y-3"
      style={{ display: showCountdown ? undefined : "none" }}
    >
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns:
            parts.length >= 4
              ? "repeat(4, minmax(0, 1fr))"
              : parts.length === 3
                ? "repeat(3, minmax(0, 1fr))"
                : "repeat(2, minmax(0, 1fr))",
        }}
      >
        {parts.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-border bg-muted/20 px-3 py-4 shadow-sm"
          >
            <div className="text-3xl font-semibold sm:text-4xl" id="countdown">
              {item.value}
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <div className="text-sm font-medium text-muted-foreground sm:text-base">
        <div>
          Ends <span id="endtime-date">{endDateDisplay}</span>
        </div>
        {timeZoneNameLong ? (
          <div className="text-xs text-muted-foreground">
            {timeZoneNameLong} {offsetString}
          </div>
        ) : null}
      </div>
    </div>
  );
};
