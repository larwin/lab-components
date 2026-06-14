import { useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  combineDateTime,
  composeMachine,
  dateOf,
  dismissable,
  dismissIntents,
  timeOf,
  timeValue,
  type DateTimeValue,
  type DateValue,
  type DismissableSlice,
  type DismissReason,
  type TimeValue,
} from "@/framework/core";
import { Overlay, useComposedMachine, useForgeEffects, useLiveRef } from "@/framework/react";
import { Calendar, type CalendarLabels } from "./Calendar";
import { DateTimeField } from "./DateTimeField";
import { TimeField } from "./TimeField";

/**
 * DateTimePicker — the DatePicker pattern extended with time: a DateTimeField
 * plus an Overlay holding the Calendar AND a TimeField (same Dismissable
 * machine for open/close). Picking a date keeps the overlay open so the time
 * can be set right after; the time half defaults to 00:00 when a date is
 * picked first, so the composed value commits immediately.
 */

export interface DateTimePickerProps {
  value?: DateTimeValue | null;
  defaultValue?: DateTimeValue;
  onValueChange?: (value: DateTimeValue | null) => void;
  min?: DateValue;
  max?: DateValue;
  isDateDisabled?: (date: DateValue) => boolean;
  locale?: string;
  showSeconds?: boolean;
  disabled?: boolean;
  name?: string;
  /** Trigger button label (SR). Default French. */
  triggerLabel?: string;
  calendarLabels?: Partial<CalendarLabels>;
  className?: string;
  "aria-label"?: string;
}

const pickerBehaviors = [dismissable] as const;

export function DateTimePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale = "fr",
  showSeconds = false,
  disabled = false,
  name,
  triggerLabel = "Ouvrir le calendrier",
  calendarLabels,
  className,
  ...rest
}: DateTimePickerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const live = useLiveRef({ onValueChange });

  // Uncontrolled fallback: the picker owns the value when no `value` prop.
  const [inner, setInner] = useState<DateTimeValue | null>(defaultValue ?? null);
  const current = value !== undefined ? value : inner;
  const setValue = (next: DateTimeValue | null) => {
    if (value === undefined) setInner(next);
    live.current.onValueChange?.(next);
  };

  const { state, dispatch, store } = useComposedMachine(() =>
    composeMachine("datetimepicker", pickerBehaviors, {}),
  );
  const open = (state.dismissable as DismissableSlice).open;
  useForgeEffects(store, {});

  const pickDate = (date: DateValue | null) => {
    if (date === null) return;
    // First pick without a time yet → midnight, so the value commits now.
    setValue(combineDateTime(date, current ? timeOf(current) : timeValue(0, 0)));
  };
  const pickTime = (time: TimeValue | null) => {
    if (time === null || current === null) return;
    setValue(combineDateTime(dateOf(current), time));
  };

  return (
    <div ref={anchorRef} className={cn("inline-flex items-center gap-1", className)}>
      <DateTimeField
        value={current}
        onValueChange={setValue}
        locale={locale}
        showSeconds={showSeconds}
        disabled={disabled}
        name={name}
        aria-label={rest["aria-label"]}
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
        <CalendarClock className="size-4" />
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
            value={current ? dateOf(current) : null}
            onValueChange={pickDate}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            locale={locale}
            labels={calendarLabels}
            className="shadow-lg"
          />
          <div className="flex items-center justify-center border-t border-border bg-surface p-2">
            <TimeField
              value={current ? timeOf(current) : null}
              onValueChange={pickTime}
              locale={locale}
              showSeconds={showSeconds}
              disabled={current === null}
              aria-label={triggerLabel}
            />
          </div>
        </div>
      </Overlay>
    </div>
  );
}
