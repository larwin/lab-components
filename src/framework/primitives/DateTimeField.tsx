import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  combineDateTime,
  dateOf,
  getTextDirection,
  isSameDateTime,
  timeOf,
  toISODateTime,
  type DateTimeValue,
  type DateValue,
  type TimeValue,
} from "@/framework/core";
import { useLiveRef } from "@/framework/react";
import { DateField } from "./DateField";
import { TimeField } from "./TimeField";

/**
 * DateTimeField — a DateField and a TimeField sharing one ARIA group: two
 * instances of the same generic segment machine, zero new logic. Each half
 * keeps its own partial entry; the composed DateTimeValue is null until BOTH
 * halves are complete, and `onValueChange` fires only when the composition
 * actually transitions (no null echo while filling the second half).
 */

export interface DateTimeFieldProps {
  value?: DateTimeValue | null;
  defaultValue?: DateTimeValue;
  onValueChange?: (value: DateTimeValue | null) => void;
  locale?: string;
  showSeconds?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
}

export function DateTimeField({
  value,
  defaultValue,
  onValueChange,
  locale = "fr",
  showSeconds = false,
  disabled = false,
  name,
  className,
  ...rest
}: DateTimeFieldProps) {
  const live = useLiveRef({ onValueChange });

  // Uncontrolled halves — they persist independently while incomplete.
  const [innerDate, setInnerDate] = useState<DateValue | null>(
    defaultValue ? dateOf(defaultValue) : null,
  );
  const [innerTime, setInnerTime] = useState<TimeValue | null>(
    defaultValue ? timeOf(defaultValue) : null,
  );
  const controlled = value !== undefined;
  const date = controlled ? (value ? dateOf(value) : innerDate) : innerDate;
  const time = controlled ? (value ? timeOf(value) : innerTime) : innerTime;

  // Emit only on real transitions of the composition.
  const lastEmitted = useRef<DateTimeValue | null>(
    value ?? (defaultValue ? combineDateTime(dateOf(defaultValue), timeOf(defaultValue)) : null),
  );
  const emit = (nextDate: DateValue | null, nextTime: TimeValue | null) => {
    const composed = nextDate && nextTime ? combineDateTime(nextDate, nextTime) : null;
    const same =
      composed === null
        ? lastEmitted.current === null
        : isSameDateTime(composed, lastEmitted.current);
    if (!same) {
      lastEmitted.current = composed;
      live.current.onValueChange?.(composed);
    }
  };

  const composed = date && time ? combineDateTime(date, time) : null;

  return (
    <div
      role="group"
      dir={getTextDirection(locale)}
      aria-label={rest["aria-label"]}
      aria-disabled={disabled || undefined}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <DateField
        value={date}
        onValueChange={(next) => {
          setInnerDate(next);
          emit(next, time);
        }}
        locale={locale}
        disabled={disabled}
      />
      <TimeField
        value={time}
        onValueChange={(next) => {
          setInnerTime(next);
          emit(date, next);
        }}
        locale={locale}
        showSeconds={showSeconds}
        disabled={disabled}
      />
      {name && <input type="hidden" name={name} value={composed ? toISODateTime(composed) : ""} />}
    </div>
  );
}
