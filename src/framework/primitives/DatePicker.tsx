import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  composeMachine,
  dismissable,
  dismissIntents,
  type DateValue,
  type DismissableSlice,
  type DismissReason,
} from "@/framework/core";
import { Overlay, useComposedMachine, useForgeEffects, useLiveRef } from "@/framework/react";
import { Calendar, type CalendarLabels } from "./Calendar";
import { DateField } from "./DateField";

/**
 * DatePicker — a DateField plus the Calendar in an Overlay (the Select
 * pattern: a Dismissable machine owns open/close, closing restores focus to
 * the trigger as a declarative `dom/restore-focus` effect). Field and grid
 * edit the same value: typing updates the calendar, picking fills the field
 * and closes.
 */

export interface DatePickerProps {
  value?: DateValue | null;
  defaultValue?: DateValue;
  onValueChange?: (date: DateValue | null) => void;
  min?: DateValue;
  max?: DateValue;
  isDateDisabled?: (date: DateValue) => boolean;
  locale?: string;
  disabled?: boolean;
  name?: string;
  /** Trigger button label (SR). Default French. */
  triggerLabel?: string;
  calendarLabels?: Partial<CalendarLabels>;
  className?: string;
  "aria-label"?: string;
}

const pickerBehaviors = [dismissable] as const;

export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale = "fr",
  disabled = false,
  name,
  triggerLabel = "Ouvrir le calendrier",
  calendarLabels,
  className,
  ...rest
}: DatePickerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const live = useLiveRef({ onValueChange });

  // Uncontrolled fallback: the picker owns the value when no `value` prop.
  const [inner, setInner] = useState<DateValue | null>(defaultValue ?? null);
  const current = value !== undefined ? value : inner;
  const setValue = (date: DateValue | null) => {
    if (value === undefined) setInner(date);
    live.current.onValueChange?.(date);
  };

  const { state, dispatch, store } = useComposedMachine(() =>
    composeMachine("datepicker", pickerBehaviors, {}),
  );
  const open = (state.dismissable as DismissableSlice).open;
  useForgeEffects(store, {});

  return (
    <div ref={anchorRef} className={cn("inline-flex items-center gap-1", className)}>
      <DateField
        value={current}
        onValueChange={setValue}
        locale={locale}
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
        <CalendarDays className="size-4" />
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
            value={current}
            onValueChange={(date) => {
              setValue(date);
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
