import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Progress — determinate or indeterminate progressbar. No machine: there is
 * no interaction, only correct ARIA derived from props (an undefined value is
 * the indeterminate state: no aria-valuenow, animated bar).
 */

export interface ProgressProps {
  /** 0..max — omit for the indeterminate state. */
  value?: number;
  max?: number;
  label?: ReactNode;
  /** Human-readable value (aria-valuetext + the right-hand text). */
  formatValue?: (value: number, max: number) => string;
  className?: string;
  "aria-label"?: string;
}

export function Progress({
  value,
  max = 100,
  label,
  formatValue,
  className,
  ...rest
}: ProgressProps) {
  const determinate = value !== undefined;
  const clamped = determinate ? Math.min(max, Math.max(0, value)) : 0;
  const text = determinate
    ? (formatValue?.(clamped, max) ?? `${Math.round((clamped / max) * 100)} %`)
    : undefined;

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-1.5", className)}>
      {(label || text) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{label}</span>
          {text && <span className="font-mono text-xs text-muted-foreground">{text}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label ? undefined : rest["aria-label"]}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={determinate ? clamped : undefined}
        aria-valuetext={text}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${(clamped / max) * 100}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        )}
      </div>
      {/* Keyframes for the indeterminate sweep, scoped here. */}
      <style>{`@keyframes progress-slide { 0% { margin-left: -33%; } 100% { margin-left: 100%; } }`}</style>
    </div>
  );
}
