/**
 * DateValue — a pure, immutable calendar date: { year, month (1-12), day }.
 *
 * No `Date`, no timezone, no clock: machine state holds plain serializable
 * values and "today" is always injected by the adapter. Arithmetic uses the
 * proleptic Gregorian civil-calendar algorithms (Howard Hinnant's
 * days_from_civil / civil_from_days), exact over the whole supported range.
 */

export interface DateValue {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31. */
  readonly day: number;
}

export const dateValue = (year: number, month: number, day: number): DateValue => ({
  year,
  month,
  day,
});

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];
}

/** Days since 1970-01-01 (negative before). */
export function toEpochDays(date: DateValue): number {
  const y = date.year - (date.month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (date.month + (date.month > 2 ? -3 : 9)) + 2) / 5) + date.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDays(days: number): DateValue {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

/** 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday). */
export function dayOfWeek(date: DateValue): number {
  return (((toEpochDays(date) + 4) % 7) + 7) % 7;
}

export function addDays(date: DateValue, days: number): DateValue {
  return fromEpochDays(toEpochDays(date) + days);
}

/** Calendar-aware: Jan 31 + 1 month = Feb 28/29 (day clamped, never overflowing). */
export function addMonths(date: DateValue, months: number): DateValue {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export const addYears = (date: DateValue, years: number): DateValue => addMonths(date, years * 12);

/** Negative when a < b, 0 when same day, positive when a > b. */
export function compareDates(a: DateValue, b: DateValue): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export const isSameDay = (a: DateValue | null, b: DateValue | null): boolean =>
  a !== null && b !== null && compareDates(a, b) === 0;

export const isSameMonth = (a: DateValue, b: DateValue): boolean =>
  a.year === b.year && a.month === b.month;

export function clampDate(
  date: DateValue,
  min?: DateValue | null,
  max?: DateValue | null,
): DateValue {
  if (min && compareDates(date, min) < 0) return min;
  if (max && compareDates(date, max) > 0) return max;
  return date;
}

export const isDateInRange = (
  date: DateValue,
  min?: DateValue | null,
  max?: DateValue | null,
): boolean => (!min || compareDates(date, min) >= 0) && (!max || compareDates(date, max) <= 0);

/** Inclusive membership in an unordered [a, b] interval. */
export function isBetween(date: DateValue, a: DateValue, b: DateValue): boolean {
  const lo = compareDates(a, b) <= 0 ? a : b;
  const hi = lo === a ? b : a;
  return compareDates(date, lo) >= 0 && compareDates(date, hi) <= 0;
}

export const startOfMonth = (date: DateValue): DateValue => ({ ...date, day: 1 });

export const endOfMonth = (date: DateValue): DateValue => ({
  year: date.year,
  month: date.month,
  day: daysInMonth(date.year, date.month),
});

/** The week containing `date`, given the locale's first day (0=Sun … 6=Sat). */
export function startOfWeek(date: DateValue, firstDayOfWeek: number): DateValue {
  return addDays(date, -((dayOfWeek(date) - firstDayOfWeek + 7) % 7));
}

export const endOfWeek = (date: DateValue, firstDayOfWeek: number): DateValue =>
  addDays(startOfWeek(date, firstDayOfWeek), 6);

/** "2026-06-12" — stable registry/serialization key, lexicographically sortable. */
export function toISODate(date: DateValue): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

export function parseISODate(text: string): DateValue | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/* ------------------------------- month grid ------------------------------- */

export interface CalendarCell {
  readonly date: DateValue;
  /** False for the dimmed leading/trailing days of adjacent months. */
  readonly inMonth: boolean;
}

/**
 * The 2D grid of a month: full weeks (rows of 7) from the week containing the
 * 1st to the week containing the last day, padded with adjacent-month cells.
 */
export function monthGrid(year: number, month: number, firstDayOfWeek: number): CalendarCell[][] {
  const last = endOfMonth({ year, month, day: 1 });
  const weeks: CalendarCell[][] = [];
  let cursor = startOfWeek({ year, month, day: 1 }, firstDayOfWeek);
  while (compareDates(cursor, last) <= 0) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(cursor, i);
        return { date, inMonth: date.month === month && date.year === year };
      }),
    );
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
