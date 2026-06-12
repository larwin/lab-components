import type { Machine } from "../runtime/machine";
import type { AriaProps, KeyBinding } from "../behaviors/behavior";
import {
  createSegmentFieldMachine,
  segmentAria,
  segmentFieldIntents,
  segmentFieldKeymap,
  normalizeDigit,
  type SegmentFieldConfig,
  type SegmentFieldState,
  type SegmentSpec,
  type SegmentValues,
} from "../field/segments";
import type { DateSegmentType } from "./intl";
import { daysInMonth, isSameDay, type DateValue } from "./value";

/**
 * Date field — a configuration of the generic segment-field machine
 * (../field/segments): day/month/year spinbuttons in locale order, digit
 * typing with auto-advance, arrows wrapping on the real month length, the
 * draft/commit rule. The composed DateValue clamps the day to the month
 * length (31/02 → 28/02), NumericValue philosophy.
 */

export type DateFieldState = SegmentFieldState;

export interface DateFieldConfig {
  /** Editable segments in locale order (from `dateFieldParts`). */
  segments: readonly DateSegmentType[];
  /** Seeds ArrowUp/Down on an empty segment — "today" injected by the adapter. */
  getPlaceholderDate?: () => DateValue;
  /** RTL flips ArrowLeft/ArrowRight. */
  direction?: () => "ltr" | "rtl";
}

/** Same intents as every segment field — dates add no vocabulary of their own. */
export const dateFieldIntents = segmentFieldIntents;
export { normalizeDigit };

const DATE_SPECS: Record<DateSegmentType, SegmentSpec> = {
  day: {
    key: "day",
    min: 1,
    max: 31,
    wrap: true,
    digits: 2,
    // Arrows wrap on the real month length when month/year are known.
    wrapMax: (values) => daysInMonth(values.year ?? 2024, values.month ?? 1),
  },
  month: { key: "month", min: 1, max: 12, wrap: true, digits: 2 },
  year: { key: "year", min: 1, max: 9999, wrap: false, digits: 4 },
};

/**
 * The composed value: null until every segment is filled and valid; the day is
 * clamped to the real month length (31/02 → 28/02).
 */
export function dateFieldValue(state: SegmentFieldState | SegmentValues): DateValue | null {
  const values: SegmentValues = "values" in state ? (state as SegmentFieldState).values : state;
  const { day, month, year } = values as {
    day?: number | null;
    month?: number | null;
    year?: number | null;
  };
  if (day == null || month == null || year == null) return null;
  if (day < 1 || month < 1 || month > 12 || year < 1) return null;
  return { year, month, day: Math.min(day, daysInMonth(year, month)) };
}

/** A DateValue spread onto segment values (controlled sync, seeding). */
export function dateSegmentValues(date: DateValue | null): SegmentValues {
  return date === null
    ? { day: null, month: null, year: null }
    : { day: date.day, month: date.month, year: date.year };
}

function segmentConfig(config: DateFieldConfig): SegmentFieldConfig<DateValue> {
  return {
    id: "datefield",
    segments: config.segments.map((type) => DATE_SPECS[type]),
    getValue: dateFieldValue,
    isEqual: isSameDay,
    getPlaceholder: config.getPlaceholderDate
      ? () => {
          const date = config.getPlaceholderDate!();
          return { day: date.day, month: date.month, year: date.year };
        }
      : undefined,
    direction: config.direction,
  };
}

export function createDateFieldMachine(config: DateFieldConfig): Machine<SegmentFieldState> {
  return createSegmentFieldMachine(segmentConfig(config));
}

/** Declarative keymap for the segments (resolved by the adapter). */
export function dateFieldKeymap(config: DateFieldConfig): KeyBinding[] {
  return segmentFieldKeymap(segmentConfig(config));
}

/** Spinbutton ARIA for one segment — derived, the shell adds the localized label. */
export function dateSegmentAria(type: DateSegmentType, value: number | null): AriaProps {
  return segmentAria(DATE_SPECS[type], value);
}
