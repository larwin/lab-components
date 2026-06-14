import { useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  compareDates,
  composeMachine,
  dismissable,
  dismissIntents,
  type DateRange,
  type DateValue,
  type DismissableSlice,
  type DismissReason,
} from "@/framework/core";
import { Overlay, useComposedMachine, useForgeEffects, useLiveRef } from "@/framework/react";
import { Calendar, type CalendarLabels } from "./Calendar";
import { DateField } from "./DateField";

/**
 * DateRangePicker — two DateFields (start/end) plus the Calendar in range
 * mode inside an Overlay. The grid commits ordered intervals by construction
 * (anchor + hover preview); the fields enforce start ≤ end by swapping on
 * commit, so the emitted range is always valid whichever endpoint was typed
 * first. Partial input (one endpoint) emits nothing.
 */

export interface DateRangePickerProps {
  value?: DateRange | null;
  defaultValue?: DateRange;
  onValueChange?: (range: DateRange | null) => void;
  min?: DateValue;
  max?: DateValue;
  isDateDisabled?: (date: DateValue) => boolean;
  locale?: string;
  disabled?: boolean;
  /** SR labels — default French. */
  startLabel?: string;
  endLabel?: string;
  triggerLabel?: string;
  calendarLabels?: Partial<CalendarLabels>;
  className?: string;
}

const pickerBehaviors = [dismissable] as const;

export function DateRangePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale = "fr",
  disabled = false,
  startLabel = "Date de début",
  endLabel = "Date de fin",
  triggerLabel = "Ouvrir le calendrier",
  calendarLabels,
  className,
}: DateRangePickerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const live = useLiveRef({ onValueChange });

  // Endpoints live separately so one side can be typed before the other.
  const [endpoints, setEndpoints] = useState<{
    start: DateValue | null;
    end: DateValue | null;
  }>({ start: defaultValue?.start ?? null, end: defaultValue?.end ?? null });
  const current = value !== undefined ? value : endpointsRange(endpoints);
  const shown =
    value !== undefined ? { start: value?.start ?? null, end: value?.end ?? null } : endpoints;

  const commit = (next: { start: DateValue | null; end: DateValue | null }) => {
    // start ≤ end, by swap — the typed order never produces an inverted range.
    const ordered =
      next.start && next.end && compareDates(next.start, next.end) > 0
        ? { start: next.end, end: next.start }
        : next;
    if (value === undefined) setEndpoints(ordered);
    live.current.onValueChange?.(endpointsRange(ordered));
  };

  const { state, dispatch, store } = useComposedMachine(() =>
    composeMachine("daterangepicker", pickerBehaviors, {}),
  );
  const open = (state.dismissable as DismissableSlice).open;
  useForgeEffects(store, {});

  return (
    <div ref={anchorRef} className={cn("inline-flex items-center gap-1", className)}>
      <DateField
        value={shown.start}
        onValueChange={(date) => commit({ start: date, end: shown.end })}
        locale={locale}
        disabled={disabled}
        aria-label={startLabel}
      />
      <span aria-hidden className="px-0.5 text-muted-foreground">
        –
      </span>
      <DateField
        value={shown.end}
        onValueChange={(date) => commit({ start: shown.start, end: date })}
        locale={locale}
        disabled={disabled}
        aria-label={endLabel}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() =>
          dispatch(
            open
              ? dismissIntents.close(undefined, "pointer")
              : dismissIntents.open(undefined, "pointer"),
          )
        }
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          open && "bg-muted text-foreground",
        )}
      >
        <CalendarRange className="size-4" />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={4}
      >
        <div role="dialog" aria-label={triggerLabel} data-autofocus tabIndex={-1}>
          <Calendar
            selectionMode="range"
            rangeValue={current}
            onRangeChange={(range) => {
              commit(range);
              dispatch(dismissIntents.close({ reason: "select" }, "program"));
            }}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            locale={locale}
            labels={calendarLabels}
            className="shadow-lg"
          />
        </div>
      </Overlay>
    </div>
  );
}

const endpointsRange = (e: { start: DateValue | null; end: DateValue | null }): DateRange | null =>
  e.start && e.end ? { start: e.start, end: e.end } : null;
