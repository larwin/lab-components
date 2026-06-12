/**
 * ZonedDateTime — pure zoned civil time, zero shipped timezone data. The
 * offset of an instant in an IANA zone is COMPUTED through
 * Intl.DateTimeFormat (timeZoneName: "longOffset", formatToParts), so DST is
 * correct by construction — when the host's tz database moves, we move.
 * `Date` appears only as a transient carrier of an epoch into Intl (the
 * date/intl discipline); values are plain serializable records and the
 * current instant is always injected by the adapter, never read here.
 *
 * Out of scope, recorded in RFC-001: the Temporal API would subsume this
 * module (Temporal.ZonedDateTime) — to be re-evaluated when runtime support
 * is universal; the public surface here (fields + timeZone + offsetMinutes)
 * is deliberately Temporal-shaped to ease that migration.
 */

import { addDays, toEpochDays, type DateValue } from "../date/value";
import {
  combineDateTime,
  dateOf,
  timeOf,
  toSecondsOfDay,
  type DateTimeValue,
  type TimeValue,
} from "./value";

/** A civil date-time pinned to an IANA zone at a resolved offset. */
export interface ZonedDateTime extends DateTimeValue {
  readonly timeZone: string;
  /** Minutes east of UTC at this precise instant (Paris in summer = +120). */
  readonly offsetMinutes: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
};

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

const offsetFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = offsetFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      year: "numeric",
    });
    offsetFormatterCache.set(timeZone, formatter);
  }
  return formatter;
};

/** Offset (minutes east of UTC) of an instant in a zone — "GMT+05:30" parsed. */
export function zoneOffset(epochMs: number, timeZone: string): number {
  const name =
    offsetFormatter(timeZone)
      .formatToParts(new Date(epochMs))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+−-])(\d{1,2}):(\d{2})/.exec(name);
  if (!match) return 0; // plain "GMT" — UTC
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Wall-clock fields of an instant in a zone. */
export function zonedFromInstant(epochMs: number, timeZone: string): ZonedDateTime {
  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // some engines render h23 midnight as "24"
    minute: get("minute"),
    second: get("second"),
    timeZone,
    offsetMinutes: zoneOffset(epochMs, timeZone),
  };
}

/** Epoch ms of civil fields read as UTC (pure civil arithmetic, no Intl). */
const utcMsFromFields = (fields: DateTimeValue): number =>
  (toEpochDays(fields) * 86400 + toSecondsOfDay(timeOf(fields))) * 1000;

const sameFields = (a: DateTimeValue, b: DateTimeValue): boolean =>
  a.year === b.year &&
  a.month === b.month &&
  a.day === b.day &&
  a.hour === b.hour &&
  a.minute === b.minute &&
  (a.second ?? 0) === (b.second ?? 0);

/**
 * The instant a wall-clock time denotes in a zone. DST transitions resolve
 * the Temporal-"compatible" way: in an overlap (fall-back, the hour exists
 * twice) the EARLIER instant wins; in a gap (spring-forward, the hour does
 * not exist) the wall clock shifts forward by the gap.
 */
export function instantFromZoned(fields: DateTimeValue, timeZone: string): number {
  const utcGuess = utcMsFromFields(fields);
  // Probe a day on each side of the guess: around a transition this collects
  // BOTH plausible offsets (probing only at the guess can miss the pre-
  // transition one and silently lose the overlap's earlier instant).
  const day = 86400000;
  const candidates = [
    ...new Set([zoneOffset(utcGuess - day, timeZone), zoneOffset(utcGuess + day, timeZone)]),
  ].sort((a, b) => b - a); // larger offset = earlier instant — overlaps pick it first
  for (const offset of candidates) {
    const instant = utcGuess - offset * 60000;
    if (
      zoneOffset(instant, timeZone) === offset &&
      sameFields(zonedFromInstant(instant, timeZone), fields)
    ) {
      return instant;
    }
  }
  // Gap: no candidate round-trips — land after the transition (clock jumps forward).
  return utcGuess - Math.min(...candidates) * 60000;
}

/** Build a ZonedDateTime from civil fields (resolving DST as instantFromZoned). */
export function zonedDateTime(date: DateValue, time: TimeValue, timeZone: string): ZonedDateTime {
  return zonedFromInstant(instantFromZoned(combineDateTime(date, time), timeZone), timeZone);
}

/** The exact instant a ZonedDateTime denotes. */
export const epochOf = (zdt: ZonedDateTime): number =>
  utcMsFromFields(zdt) - zdt.offsetMinutes * 60000;

/** Same instant seen from another zone (the converter's whole job). */
export const withTimeZone = (zdt: ZonedDateTime, timeZone: string): ZonedDateTime =>
  zonedFromInstant(epochOf(zdt), timeZone);

/**
 * Calendar arithmetic, DST-safe: adding a day keeps the WALL time (Paris
 * 09:00 + 1 day = 09:00 even across the spring transition — the day is 23
 * exact hours long).
 */
export function addZonedDays(zdt: ZonedDateTime, days: number): ZonedDateTime {
  const fields = combineDateTime(addDays(dateOf(zdt), days), timeOf(zdt));
  return zonedFromInstant(instantFromZoned(fields, zdt.timeZone), zdt.timeZone);
}

/** Exact-duration arithmetic: instant + minutes (the wall clock may jump at DST). */
export function addZonedMinutes(zdt: ZonedDateTime, minutes: number): ZonedDateTime {
  return zonedFromInstant(epochOf(zdt) + minutes * 60000, zdt.timeZone);
}

/* ------------------------------ zone directory ----------------------------- */

/** All IANA zones the runtime knows — straight from Intl, zero shipped data. */
export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timeZoneCity(timeZone: string): string {
  const leaf = timeZone.split("/").pop() ?? timeZone;
  return leaf.replace(/_/g, " ");
}

export type TimeZoneNameStyle = "long" | "short" | "shortOffset" | "longOffset" | "longGeneric";

const nameFormatterCache = new Map<string, Intl.DateTimeFormat>();

/** Localized zone name ("heure d'Europe centrale", "CET", "GMT+1"…) at an instant. */
export function timeZoneName(
  timeZone: string,
  locale = "en",
  style: TimeZoneNameStyle = "long",
  epochMs = 0,
): string {
  const key = `${locale}|${timeZone}|${style}`;
  let formatter = nameFormatterCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, {
        timeZone,
        timeZoneName: style,
        year: "numeric",
      });
    } catch {
      return timeZoneCity(timeZone);
    }
    nameFormatterCache.set(key, formatter);
  }
  return (
    formatter.formatToParts(new Date(epochMs)).find((p) => p.type === "timeZoneName")?.value ??
    timeZoneCity(timeZone)
  );
}

/** "UTC+02:00" / "UTC−09:30" — stable offset label for grouping and sorting. */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "−" : "+";
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Format the instant a ZonedDateTime denotes, in its own zone and locale. */
export function formatZoned(
  zdt: ZonedDateTime,
  locale = "en",
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: zdt.timeZone }).format(
    new Date(epochOf(zdt)),
  );
}
