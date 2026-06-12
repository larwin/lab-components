import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Meter — a measurement within a known range (disk usage, battery, score),
 * NOT progress over time. role="meter" with low/high/optimum zones colouring
 * the bar like the native <meter> element.
 */

export interface MeterProps {
  value: number;
  min?: number;
  max?: number;
  /** Zone boundaries, native <meter> semantics. */
  low?: number;
  high?: number;
  optimum?: number;
  label?: ReactNode;
  formatValue?: (value: number) => string;
  className?: string;
  "aria-label"?: string;
}

type Zone = "good" | "warning" | "critical";

/** Which zone is the value in, given where the optimum lives? */
const zoneOf = (
  value: number,
  min: number,
  max: number,
  low?: number,
  high?: number,
  optimum?: number,
): Zone => {
  const lo = low ?? min;
  const hi = high ?? max;
  const opt = optimum ?? (lo + hi) / 2;
  if (opt >= hi) {
    // Higher is better (battery): below low is critical.
    return value >= hi ? "good" : value >= lo ? "warning" : "critical";
  }
  if (opt <= lo) {
    // Lower is better (disk usage): above high is critical.
    return value <= lo ? "good" : value <= hi ? "warning" : "critical";
  }
  // Middle is best.
  return value >= lo && value <= hi ? "good" : "warning";
};

const ZONE_STYLES: Record<Zone, string> = {
  good: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function Meter({
  value,
  min = 0,
  max = 100,
  low,
  high,
  optimum,
  label,
  formatValue,
  className,
  ...rest
}: MeterProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const ratio = max === min ? 0 : (clamped - min) / (max - min);
  const zone = zoneOf(clamped, min, max, low, high, optimum);
  const text = formatValue?.(clamped) ?? String(clamped);

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-1.5", className)}>
      {(label || text) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{label}</span>
          <span className="font-mono text-xs text-muted-foreground">{text}</span>
        </div>
      )}
      <div
        role="meter"
        aria-label={label ? undefined : rest["aria-label"]}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={formatValue ? text : undefined}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", ZONE_STYLES[zone])}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
