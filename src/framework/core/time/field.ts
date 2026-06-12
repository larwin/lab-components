import type { Machine } from "../runtime/machine";
import type { AriaProps, KeyBinding } from "../behaviors/behavior";
import {
  createSegmentFieldMachine,
  segmentAria,
  segmentFieldKeymap,
  type SegmentFieldConfig,
  type SegmentFieldState,
  type SegmentSpec,
  type SegmentValues,
} from "../field/segments";
import type { TimeSegmentType } from "./intl";
import {
  dayPeriodOf,
  displayHour,
  hourBounds,
  hourFromDisplay,
  isSameTime,
  timeValue,
  usesDayPeriod,
  type HourCycle,
  type TimeValue,
} from "./value";

/**
 * Time field — a configuration of the generic segment-field machine
 * (../field/segments): hour/minute/second/dayPeriod segments in locale order,
 * the hour displayed in the locale's cycle (h12 → 1-12 + AM/PM, h23 → 0-23)
 * while the composed TimeValue always stores 0-23. dayPeriod is a cyclic
 * textual segment: arrows toggle, typing the localized "a"/"p" initial sets
 * it outright.
 */

export interface TimeFieldConfig {
  /** Editable segments in locale order (from `timeFieldParts`). */
  segments: readonly TimeSegmentType[];
  /** The locale's hour cycle (from `hourCycleOf`). */
  hourCycle: HourCycle;
  /** Localized [AM, PM] labels — drive dayPeriod typing ("a"/"p" localized). */
  dayPeriodLabels?: readonly [string, string];
  /** Seeds ArrowUp/Down on an empty segment — "now" injected by the adapter. */
  getPlaceholderTime?: () => TimeValue;
  /** RTL flips ArrowLeft/ArrowRight. */
  direction?: () => "ltr" | "rtl";
}

/** Matches the first character of a localized day-period label (case-folded). */
export function dayPeriodParser(
  labels: readonly [string, string],
): (char: string) => number | null {
  const initials = labels.map((label) => label.charAt(0).toLocaleLowerCase());
  return (char) => {
    if (char.length !== 1) return null;
    const folded = char.toLocaleLowerCase();
    if (folded === initials[0]) return 0;
    if (folded === initials[1]) return 1;
    // Latin fallback so "a"/"p" always work, whatever the locale labels.
    if (folded === "a") return 0;
    if (folded === "p") return 1;
    return null;
  };
}

/** Segment descriptors for the generic machine, derived from the hour cycle. */
export function timeSegmentSpecs(config: TimeFieldConfig): SegmentSpec[] {
  const bounds = hourBounds(config.hourCycle);
  const specs: Record<TimeSegmentType, SegmentSpec> = {
    hour: { key: "hour", min: bounds.min, max: bounds.max, wrap: true, digits: 2 },
    minute: { key: "minute", min: 0, max: 59, wrap: true, digits: 2 },
    second: { key: "second", min: 0, max: 59, wrap: true, digits: 2 },
    dayPeriod: {
      key: "dayPeriod",
      min: 0,
      max: 1,
      wrap: true,
      digits: 1,
      parseChar: dayPeriodParser(config.dayPeriodLabels ?? ["AM", "PM"]),
    },
  };
  return config.segments.map((type) => specs[type]);
}

/**
 * The composed value: null until every configured segment is filled and valid
 * (a 0 typed into an h12 hour is a draft, not midnight). Hour converts from
 * the display cycle to 0-23 storage.
 */
export function timeFieldValue(values: SegmentValues, config: TimeFieldConfig): TimeValue | null {
  const bounds = hourBounds(config.hourCycle);
  const hour = values.hour ?? null;
  const minute = values.minute ?? null;
  if (hour === null || minute === null) return null;
  if (hour < bounds.min || hour > bounds.max || minute > 59) return null;
  const withSeconds = config.segments.includes("second");
  const second = withSeconds ? values.second : undefined;
  if (withSeconds && (second === null || second === undefined || second > 59)) return null;
  let dayPeriod: 0 | 1 = 0;
  if (usesDayPeriod(config.hourCycle)) {
    const dp = values.dayPeriod ?? null;
    if (dp === null) return null;
    dayPeriod = dp === 1 ? 1 : 0;
  }
  return timeValue(
    hourFromDisplay(hour, dayPeriod, config.hourCycle),
    minute,
    withSeconds ? (second as number) : undefined,
  );
}

/** A TimeValue (0-23 storage) spread onto the field's display segments. */
export function timeSegmentValues(time: TimeValue | null, config: TimeFieldConfig): SegmentValues {
  if (time === null) {
    return Object.fromEntries(config.segments.map((s) => [s, null]));
  }
  const record: Record<string, number | null> = {};
  for (const segment of config.segments) {
    if (segment === "hour") record.hour = displayHour(time.hour, config.hourCycle);
    else if (segment === "minute") record.minute = time.minute;
    else if (segment === "second") record.second = time.second ?? 0;
    else record.dayPeriod = dayPeriodOf(time.hour);
  }
  return record;
}

function segmentConfig(config: TimeFieldConfig): SegmentFieldConfig<TimeValue> {
  return {
    id: "timefield",
    segments: timeSegmentSpecs(config),
    getValue: (values) => timeFieldValue(values, config),
    isEqual: isSameTime,
    getPlaceholder: config.getPlaceholderTime
      ? () => {
          const seeded = timeSegmentValues(config.getPlaceholderTime!(), config);
          return Object.fromEntries(Object.entries(seeded).filter(([, v]) => v !== null)) as Record<
            string,
            number
          >;
        }
      : undefined,
    direction: config.direction,
  };
}

export function createTimeFieldMachine(config: TimeFieldConfig): Machine<SegmentFieldState> {
  return createSegmentFieldMachine(segmentConfig(config));
}

export function timeFieldKeymap(config: TimeFieldConfig): KeyBinding[] {
  return segmentFieldKeymap(segmentConfig(config));
}

/**
 * Spinbutton ARIA for one time segment — dayPeriod announces its localized
 * label as valuetext (0/1 means nothing to a screen reader).
 */
export function timeSegmentAria(
  type: TimeSegmentType,
  value: number | null,
  config: TimeFieldConfig,
): AriaProps {
  const spec = timeSegmentSpecs(config).find((s) => s.key === type) ?? {
    key: type,
    min: 0,
    max: 59,
    wrap: true,
    digits: 2,
  };
  const valueText =
    type === "dayPeriod" && value !== null
      ? (config.dayPeriodLabels ?? ["AM", "PM"])[value === 1 ? 1 : 0]
      : undefined;
  return segmentAria(spec, value, valueText);
}
