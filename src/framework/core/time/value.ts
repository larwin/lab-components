/**
 * TimeValue — a pure, immutable wall-clock time: { hour (0-23), minute,
 * second? }. No `Date`, no timezone, no clock: machine state holds plain
 * serializable values and "now" is always injected by the adapter. Seconds
 * are opt-in — `second` stays absent unless the field enables it, and
 * arithmetic preserves its presence.
 *
 * Hour-cycle conversions (h11/h12/h23/h24) are pure functions here; WHICH
 * cycle a locale uses comes from Intl (see ./intl).
 */

import type { DateValue } from "../date/value";
import { addDays } from "../date/value";

export interface TimeValue {
  /** 0-23 — storage is always the 24-hour day; display cycles convert. */
  readonly hour: number;
  /** 0-59. */
  readonly minute: number;
  /** 0-59 — present only when seconds are enabled. */
  readonly second?: number;
}

export const timeValue = (hour: number, minute: number, second?: number): TimeValue =>
  second === undefined ? { hour, minute } : { hour, minute, second };

export const SECONDS_PER_DAY = 86400;

export function toSecondsOfDay(time: TimeValue): number {
  return time.hour * 3600 + time.minute * 60 + (time.second ?? 0);
}

export function fromSecondsOfDay(seconds: number, withSeconds = false): TimeValue {
  const s = ((seconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const hour = Math.floor(s / 3600);
  const minute = Math.floor((s % 3600) / 60);
  return withSeconds ? { hour, minute, second: s % 60 } : { hour, minute };
}

/** Wraps across midnight: 23:59 + 1 min = 00:00. Seconds presence preserved. */
export function addMinutes(time: TimeValue, minutes: number): TimeValue {
  return fromSecondsOfDay(toSecondsOfDay(time) + minutes * 60, time.second !== undefined);
}

export const addHours = (time: TimeValue, hours: number): TimeValue => addMinutes(time, hours * 60);

export function addSeconds(time: TimeValue, seconds: number): TimeValue {
  return fromSecondsOfDay(toSecondsOfDay(time) + seconds, true);
}

/** Negative when a < b, 0 when simultaneous, positive when a > b. */
export function compareTimes(a: TimeValue, b: TimeValue): number {
  return toSecondsOfDay(a) - toSecondsOfDay(b);
}

export const isSameTime = (a: TimeValue | null, b: TimeValue | null): boolean =>
  a !== null && b !== null && compareTimes(a, b) === 0;

export function clampTime(
  time: TimeValue,
  min?: TimeValue | null,
  max?: TimeValue | null,
): TimeValue {
  if (min && compareTimes(time, min) < 0) return min;
  if (max && compareTimes(time, max) > 0) return max;
  return time;
}

export const isTimeInRange = (
  time: TimeValue,
  min?: TimeValue | null,
  max?: TimeValue | null,
): boolean => (!min || compareTimes(time, min) >= 0) && (!max || compareTimes(time, max) <= 0);

/** Snap to the nearest step multiple (minutes), wrapping within the day. */
export function roundToMinuteStep(time: TimeValue, step: number): TimeValue {
  if (step <= 1) return time;
  const minutes = Math.round((time.hour * 60 + time.minute) / step) * step;
  return fromSecondsOfDay(minutes * 60, time.second !== undefined);
}

/** "14:05" or "14:05:09" — stable serialization key, lexicographically sortable. */
export function toISOTime(time: TimeValue): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${pad(time.hour)}:${pad(time.minute)}`;
  return time.second === undefined ? base : `${base}:${pad(time.second)}`;
}

export function parseISOTime(text: string): TimeValue | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? undefined : Number(match[3]);
  if (hour > 23 || minute > 59 || (second !== undefined && second > 59)) return null;
  return timeValue(hour, minute, second);
}

/* ------------------------------- hour cycles ------------------------------- */

/** CLDR hour cycles: h23 = 0-23 (fr), h12 = 1-12 + AM/PM (en-US), h11 = 0-11 + AM/PM, h24 = 1-24. */
export type HourCycle = "h11" | "h12" | "h23" | "h24";

export const usesDayPeriod = (cycle: HourCycle): boolean => cycle === "h11" || cycle === "h12";

/** Display bounds of the hour segment for a cycle. */
export function hourBounds(cycle: HourCycle): { min: number; max: number } {
  switch (cycle) {
    case "h11":
      return { min: 0, max: 11 };
    case "h12":
      return { min: 1, max: 12 };
    case "h23":
      return { min: 0, max: 23 };
    case "h24":
      return { min: 1, max: 24 };
  }
}

/** 0 = AM, 1 = PM. */
export const dayPeriodOf = (hour: number): 0 | 1 => (hour < 12 ? 0 : 1);

/** 24-hour storage → displayed hour for the cycle (14 → 2 in h12, 0 → 12). */
export function displayHour(hour: number, cycle: HourCycle): number {
  switch (cycle) {
    case "h23":
      return hour;
    case "h24":
      return hour === 0 ? 24 : hour;
    case "h11":
      return hour % 12;
    case "h12":
      return hour % 12 === 0 ? 12 : hour % 12;
  }
}

/** Displayed hour (+ dayPeriod for h11/h12) → 24-hour storage. */
export function hourFromDisplay(display: number, dayPeriod: 0 | 1, cycle: HourCycle): number {
  switch (cycle) {
    case "h23":
      return display;
    case "h24":
      return display === 24 ? 0 : display;
    case "h11":
      return display + dayPeriod * 12;
    case "h12":
      return (display % 12) + dayPeriod * 12;
  }
}

/* ------------------------------ date + time ------------------------------ */

/** A pure civil date-time — flat composition of DateValue and TimeValue. */
export interface DateTimeValue extends DateValue, TimeValue {}

export const combineDateTime = (date: DateValue, time: TimeValue): DateTimeValue => ({
  year: date.year,
  month: date.month,
  day: date.day,
  ...timeValue(time.hour, time.minute, time.second),
});

export const dateOf = (dt: DateTimeValue): DateValue => ({
  year: dt.year,
  month: dt.month,
  day: dt.day,
});

export const timeOf = (dt: DateTimeValue): TimeValue => timeValue(dt.hour, dt.minute, dt.second);

export function compareDateTimes(a: DateTimeValue, b: DateTimeValue): number {
  return (
    a.year - b.year || a.month - b.month || a.day - b.day || compareTimes(timeOf(a), timeOf(b))
  );
}

export const isSameDateTime = (a: DateTimeValue | null, b: DateTimeValue | null): boolean =>
  a !== null && b !== null && compareDateTimes(a, b) === 0;

/** Civil arithmetic across midnight: 23:30 + 45 min rolls the date forward. */
export function addDateTimeMinutes(dt: DateTimeValue, minutes: number): DateTimeValue {
  const total = toSecondsOfDay(timeOf(dt)) + minutes * 60;
  const dayShift = Math.floor(total / SECONDS_PER_DAY);
  return combineDateTime(
    dayShift === 0 ? dateOf(dt) : addDays(dateOf(dt), dayShift),
    fromSecondsOfDay(total, dt.second !== undefined),
  );
}

/** "2026-06-12T14:05" / "…T14:05:09" — sortable serialization. */
export function toISODateTime(dt: DateTimeValue): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(dt.year, 4)}-${pad(dt.month, 2)}-${pad(dt.day, 2)}T${toISOTime(timeOf(dt))}`;
}
