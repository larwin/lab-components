/**
 * Time-picker geometry & option policies — every decision the visual
 * TimePicker variants need, as pure Node-tested functions. The variants share
 * ONE source of truth (the TimeValue) and existing machines (the listbox
 * composition for columns/wheel, NumericValue for the dial); what differs is
 * pure geometry: which options exist and which are disabled (columns), where
 * a wheel offset settles (wheel), how an angle maps to a value (dial). No
 * machine here — shells dispatch existing intents with these results.
 */

import {
  hourBounds,
  hourFromDisplay,
  isTimeInRange,
  usesDayPeriod,
  type HourCycle,
  type TimeValue,
} from "./value";

/* ------------------------------ column options ----------------------------- */

export interface TimePickerOptionsConfig {
  hourCycle: HourCycle;
  /** Minute granularity (1/5/15…). Default 1. */
  minuteStep?: number;
  min?: TimeValue | null;
  max?: TimeValue | null;
  isTimeDisabled?: (time: TimeValue) => boolean;
}

export interface TimeOption {
  /** Display value (display hour for the cycle, minute, or dayPeriod 0/1). */
  readonly value: number;
  readonly disabled: boolean;
}

/** Minute candidates for a step: 0, step, 2·step… < 60. */
export function minuteSteps(step = 1): number[] {
  const safe = Math.max(1, Math.floor(step));
  const out: number[] = [];
  for (let m = 0; m < 60; m += safe) out.push(m);
  return out;
}

const timeDisabled = (config: TimePickerOptionsConfig, hour: number, minute: number): boolean =>
  !isTimeInRange({ hour, minute }, config.min, config.max) ||
  (config.isTimeDisabled?.({ hour, minute }) ?? false);

/**
 * Hour options in display values for the cycle (1-12 + dayPeriod, 0-23…).
 * An hour is disabled when EVERY minute candidate inside it is disabled —
 * min/max and isTimeDisabled are evaluated per concrete time, never guessed.
 */
export function hourOptions(config: TimePickerOptionsConfig, dayPeriod: 0 | 1 = 0): TimeOption[] {
  const bounds = hourBounds(config.hourCycle);
  const minutes = minuteSteps(config.minuteStep);
  const out: TimeOption[] = [];
  for (let display = bounds.min; display <= bounds.max; display++) {
    const hour = hourFromDisplay(display, dayPeriod, config.hourCycle);
    out.push({ value: display, disabled: minutes.every((m) => timeDisabled(config, hour, m)) });
  }
  return out;
}

/** Minute options for a known (storage) hour; all enabled while the hour is unknown. */
export function minuteOptions(config: TimePickerOptionsConfig, hour: number | null): TimeOption[] {
  return minuteSteps(config.minuteStep).map((minute) => ({
    value: minute,
    disabled: hour === null ? false : timeDisabled(config, hour, minute),
  }));
}

/** AM/PM options — a period is disabled when all of its hours are. */
export function dayPeriodOptions(config: TimePickerOptionsConfig): TimeOption[] {
  if (!usesDayPeriod(config.hourCycle)) return [];
  return ([0, 1] as const).map((period) => ({
    value: period,
    disabled: hourOptions(config, period).every((o) => o.disabled),
  }));
}

/** Nearest non-disabled option around `index` (the wheel never settles on a hole). */
export function nearestEnabledOption(options: readonly TimeOption[], index: number): number | null {
  if (options.length === 0) return null;
  const clamped = Math.min(options.length - 1, Math.max(0, index));
  for (let d = 0; d < options.length; d++) {
    for (const candidate of d === 0 ? [clamped] : [clamped - d, clamped + d]) {
      if (candidate >= 0 && candidate < options.length && !options[candidate].disabled) {
        return candidate;
      }
    }
  }
  return null;
}

/* --------------------------------- wheel ---------------------------------- */

/** The item index a wheel offset (px from item 0 centered) settles on. */
export function wheelIndexForOffset(offset: number, itemHeight: number, count: number): number {
  if (itemHeight <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / itemHeight)));
}

export const wheelOffsetForIndex = (index: number, itemHeight: number): number =>
  index * itemHeight;

/**
 * Inertia + snap as one pure projection: a release at `velocity` (px/ms)
 * coasts d = v²/2a in its direction, then snaps to the nearest item. The
 * shell animates toward the returned offset; keyboard never comes here (it is
 * the same Navigable machine as every list).
 */
export function wheelSettle(
  offset: number,
  velocity: number,
  itemHeight: number,
  count: number,
  deceleration = 0.003,
): { index: number; offset: number } {
  const coast = Math.sign(velocity) * ((velocity * velocity) / (2 * Math.max(1e-6, deceleration)));
  const index = wheelIndexForOffset(offset + coast, itemHeight, count);
  return { index, offset: wheelOffsetForIndex(index, itemHeight) };
}

/* ---------------------------------- dial ----------------------------------- */

/** Angle of a screen vector, degrees 0-360, 0 at 12 o'clock, clockwise (y down). */
export function pointToAngle(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Angle of a value on a dial of `count` graduations (0 at 12 o'clock). */
export function angleForValue(value: number, count: number): number {
  return ((((value % count) + count) % count) * 360) / count;
}

/**
 * Snap an angle to the nearest of an arbitrary candidate set on a `count`
 * dial — exact for any minuteStep, even ones that don't divide 60 (the gap
 * around 12 o'clock is handled by true circular distance, not rounding).
 */
export function snapAngleToValues(angle: number, values: readonly number[], count: number): number {
  let best = values[0] ?? 0;
  let bestDistance = Infinity;
  for (const value of values) {
    const diff = Math.abs(angle - angleForValue(value, count));
    const distance = Math.min(diff, 360 - diff);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = value;
    }
  }
  return best;
}

export const minuteAngle = (minute: number): number => angleForValue(minute, 60);

/** Pointer → minute with step magnetism. */
export function dialMinuteFromPoint(dx: number, dy: number, step = 1): number {
  return snapAngleToValues(pointToAngle(dx, dy), minuteSteps(step), 60);
}

export const hourAngle = (hour: number): number => angleForValue(hour % 12, 12);

/** Inner-ring boundary as a fraction of the dial radius (24-hour dials). */
export const DIAL_INNER_RING_RATIO = 0.62;

/** True when a (storage) hour renders on the inner ring of a 24-hour dial. */
export function hourOnInnerRing(hour: number, cycle: HourCycle): boolean {
  if (usesDayPeriod(cycle)) return false;
  return hour === 0 || hour > 12;
}

/**
 * Pointer → storage hour (0-23). 12-hour cycles use a single ring + the
 * current dayPeriod; 24-hour cycles use two rings (outer 1-12, inner 13-00 —
 * the Material clock), discriminated by the pointer's distance ratio
 * (distance / dial radius).
 */
export function dialHourFromPoint(
  dx: number,
  dy: number,
  distanceRatio: number,
  cycle: HourCycle,
  dayPeriod: 0 | 1 = 0,
  innerRingRatio = DIAL_INNER_RING_RATIO,
): number {
  const slot = snapAngleToValues(
    pointToAngle(dx, dy),
    Array.from({ length: 12 }, (_, i) => i),
    12,
  );
  if (usesDayPeriod(cycle)) {
    return hourFromDisplay(slot === 0 ? 12 : slot, dayPeriod, "h12");
  }
  const inner = distanceRatio < innerRingRatio;
  if (inner) return slot === 0 ? 0 : slot + 12;
  return slot === 0 ? 12 : slot;
}
