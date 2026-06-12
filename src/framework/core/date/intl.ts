/**
 * Locale services for dates — everything derives from Intl at runtime, zero
 * locale data shipped. `Date` objects appear only as transient, immutable
 * carriers handed to Intl.DateTimeFormat (always UTC); they never enter
 * machine state (see ./value — state is pure DateValue).
 */

import type { DateValue } from "./value";

const dtfCache = new Map<string, Intl.DateTimeFormat>();

const dtf = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dtfCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    dtfCache.set(key, formatter);
  }
  return formatter;
};

/** Transient UTC carrier — setUTCFullYear keeps years 0-99 exact. */
const utc = (date: DateValue): Date => {
  const carrier = new Date(0);
  carrier.setUTCFullYear(date.year, date.month - 1, date.day);
  return carrier;
};

export function formatDate(
  date: DateValue,
  locale = "en",
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  return dtf(locale, options).format(utc(date));
}

/** "juin 2026" / "June 2026" / "يونيو ٢٠٢٦" — calendar header & SR announcements. */
export function formatMonthYear(year: number, month: number, locale = "en"): string {
  return dtf(locale, { month: "long", year: "numeric" }).format(utc({ year, month, day: 1 }));
}

/**
 * The locale's first day of week, 0 = Sunday … 6 = Saturday.
 * Uses Intl.Locale week info (CLDR: 1 = Monday … 7 = Sunday, hence `% 7`),
 * with a small region fallback for runtimes without it.
 */
export function firstDayOfWeek(locale: string): number {
  try {
    const resolved = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = resolved.getWeekInfo?.() ?? resolved.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    /* malformed locale — fall through to the region table */
  }
  return fallbackFirstDay(locale);
}

const SATURDAY_REGIONS = new Set([
  "AE",
  "AF",
  "BH",
  "DJ",
  "DZ",
  "EG",
  "IQ",
  "IR",
  "JO",
  "KW",
  "LY",
  "OM",
  "QA",
  "SD",
  "SY",
  "YE",
]);
const SUNDAY_REGIONS = new Set([
  "AS",
  "BR",
  "BS",
  "BT",
  "BZ",
  "CA",
  "CO",
  "DO",
  "GT",
  "GU",
  "HK",
  "HN",
  "ID",
  "IL",
  "IN",
  "JM",
  "JP",
  "KE",
  "KH",
  "KR",
  "LA",
  "MH",
  "MM",
  "MO",
  "MX",
  "NI",
  "PA",
  "PE",
  "PH",
  "PK",
  "PR",
  "PT",
  "PY",
  "SA",
  "SG",
  "SV",
  "TH",
  "TT",
  "TW",
  "UM",
  "US",
  "VE",
  "VI",
  "WS",
  "ZA",
  "ZW",
]);

function fallbackFirstDay(locale: string): number {
  let region: string | undefined;
  try {
    region = new Intl.Locale(locale).maximize().region;
  } catch {
    region = locale.split("-")[1]?.toUpperCase();
  }
  if (region && SATURDAY_REGIONS.has(region)) return 6;
  if (region && SUNDAY_REGIONS.has(region)) return 0;
  return 1; // Monday — most of the world
}

export type DayPeriodStyle = "narrow" | "short" | "long";

/** Localized weekday names indexed 0 = Sunday … 6 = Saturday. */
export function weekdayNames(locale = "en", style: DayPeriodStyle = "short"): string[] {
  const formatter = dtf(locale, { weekday: style });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(utc({ year: 2023, month: 1, day: 1 + i })),
  );
}

/* --------------------------- date field segments --------------------------- */

export type DateSegmentType = "day" | "month" | "year";

export type DateFieldPart =
  | { readonly type: DateSegmentType }
  | { readonly type: "literal"; readonly value: string };

/**
 * The locale's date-field structure from Intl.formatToParts: editable segments
 * in locale order interleaved with literal separators — "dd/mm/yyyy" (fr),
 * "mm/dd/yyyy" (en-US), RTL-marked separators (ar)…
 */
export function dateFieldParts(locale = "en"): DateFieldPart[] {
  const formatter = dtf(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
  const out: DateFieldPart[] = [];
  for (const part of formatter.formatToParts(utc({ year: 2023, month: 12, day: 31 }))) {
    if (part.type === "day" || part.type === "month" || part.type === "year") {
      out.push({ type: part.type });
    } else {
      out.push({ type: "literal", value: part.value });
    }
  }
  return out;
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

/** "jour" / "month" / "سنة" — localized segment labels via Intl.DisplayNames. */
export function dateUnitLabel(unit: DateSegmentType, locale = "en"): string {
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

/** Localized month names indexed 0 = January … 11 = December. */
export function monthNames(locale = "en", style: "long" | "short" | "narrow" = "long"): string[] {
  const formatter = dtf(locale, { month: style });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(utc({ year: 2023, month: i + 1, day: 1 })),
  );
}
