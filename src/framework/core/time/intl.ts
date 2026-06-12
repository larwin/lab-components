/**
 * Locale services for times — everything derives from Intl at runtime, zero
 * locale data shipped. Same discipline as ../date/intl: `Date` objects are
 * transient UTC carriers handed to Intl.DateTimeFormat, never machine state.
 * The 12/24-hour question is never guessed: the locale's hour cycle comes
 * from Intl.DateTimeFormat resolvedOptions.
 */

import { utcFormatter } from "../date/intl";
import type { HourCycle, TimeValue } from "./value";

/** Transient UTC carrier on an arbitrary fixed day. */
const utcTime = (time: TimeValue): Date => {
  const carrier = new Date(0);
  carrier.setUTCFullYear(2023, 0, 1);
  carrier.setUTCHours(time.hour, time.minute, time.second ?? 0, 0);
  return carrier;
};

/** The locale's hour cycle (en-US → h12, fr → h23, ja → h23…), from Intl. */
export function hourCycleOf(locale = "en"): HourCycle {
  const resolved = utcFormatter(locale, { hour: "numeric" }).resolvedOptions();
  const cycle = (resolved as { hourCycle?: string }).hourCycle;
  if (cycle === "h11" || cycle === "h12" || cycle === "h23" || cycle === "h24") return cycle;
  return resolved.hour12 ? "h12" : "h23";
}

export function formatTime(
  time: TimeValue,
  locale = "en",
  options: Intl.DateTimeFormatOptions = {},
): string {
  const base: Intl.DateTimeFormatOptions =
    Object.keys(options).length > 0
      ? options
      : {
          hour: "numeric",
          minute: "2-digit",
          second: time.second !== undefined ? "2-digit" : undefined,
        };
  return utcFormatter(locale, base).format(utcTime(time));
}

/* --------------------------- time field segments --------------------------- */

export type TimeSegmentType = "hour" | "minute" | "second" | "dayPeriod";

export type TimeFieldPart =
  | { readonly type: TimeSegmentType }
  | { readonly type: "literal"; readonly value: string };

/**
 * The locale's time-field structure from Intl.formatToParts: editable segments
 * in locale order interleaved with literal separators — "2:08 PM" (en-US),
 * "14:08" (fr), dayPeriod-first locales (ko) come out in their real order.
 */
export function timeFieldParts(locale = "en", { seconds = false } = {}): TimeFieldPart[] {
  const formatter = utcFormatter(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
  });
  const out: TimeFieldPart[] = [];
  for (const part of formatter.formatToParts(utcTime({ hour: 14, minute: 8, second: 5 }))) {
    if (
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second" ||
      part.type === "dayPeriod"
    ) {
      out.push({ type: part.type });
    } else {
      out.push({ type: "literal", value: part.value });
    }
  }
  return out;
}

/** Localized [AM, PM] labels — forced 12-hour format so every locale yields them. */
export function dayPeriodLabels(locale = "en"): readonly [string, string] {
  const formatter = utcFormatter(locale, { hour: "numeric", hour12: true });
  const labelAt = (hour: number): string =>
    formatter.formatToParts(utcTime({ hour, minute: 0 })).find((p) => p.type === "dayPeriod")
      ?.value ?? (hour < 12 ? "AM" : "PM");
  return [labelAt(9), labelAt(21)];
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

/** "heure" / "minute" / "ص/م" — localized segment labels via Intl.DisplayNames. */
export function timeUnitLabel(unit: TimeSegmentType, locale = "en"): string {
  try {
    let names = displayNamesCache.get(locale);
    if (!names) {
      names = new Intl.DisplayNames(locale, { type: "dateTimeField" });
      displayNamesCache.set(locale, names);
    }
    return names.of(unit) ?? unit;
  } catch {
    return unit;
  }
}
