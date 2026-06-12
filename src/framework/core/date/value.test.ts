// @vitest-environment node
// Pure calendar arithmetic — no Date in any input or output.
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  compareDates,
  dateValue,
  dayOfWeek,
  daysInMonth,
  endOfMonth,
  endOfWeek,
  fromEpochDays,
  isBetween,
  isDateInRange,
  isLeapYear,
  isSameDay,
  monthGrid,
  parseISODate,
  startOfWeek,
  toEpochDays,
  toISODate,
} from "./value";

describe("epoch conversion", () => {
  it("1970-01-01 is day 0 (a Thursday)", () => {
    expect(toEpochDays(dateValue(1970, 1, 1))).toBe(0);
    expect(dayOfWeek(dateValue(1970, 1, 1))).toBe(4);
  });

  it("round-trips across centuries and leap boundaries", () => {
    for (const d of [
      dateValue(2026, 6, 12),
      dateValue(2000, 2, 29),
      dateValue(1900, 3, 1),
      dateValue(1582, 10, 15),
      dateValue(2400, 12, 31),
    ]) {
      expect(fromEpochDays(toEpochDays(d))).toEqual(d);
    }
  });

  it("consecutive days have consecutive epoch numbers across month/year edges", () => {
    expect(toEpochDays(dateValue(2026, 1, 1)) - toEpochDays(dateValue(2025, 12, 31))).toBe(1);
    expect(toEpochDays(dateValue(2024, 3, 1)) - toEpochDays(dateValue(2024, 2, 29))).toBe(1);
  });
});

describe("leap years & month lengths", () => {
  it("applies the Gregorian rules (divisible by 4, not 100, except 400)", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it("February follows the leap rule", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 6)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("arithmetic", () => {
  it("addDays crosses months and years", () => {
    expect(addDays(dateValue(2026, 6, 12), 30)).toEqual(dateValue(2026, 7, 12));
    expect(addDays(dateValue(2026, 1, 1), -1)).toEqual(dateValue(2025, 12, 31));
  });

  it("addMonths clamps the day instead of overflowing (Jan 31 + 1 = Feb 28)", () => {
    expect(addMonths(dateValue(2026, 1, 31), 1)).toEqual(dateValue(2026, 2, 28));
    expect(addMonths(dateValue(2024, 1, 31), 1)).toEqual(dateValue(2024, 2, 29));
    expect(addMonths(dateValue(2026, 3, 31), -1)).toEqual(dateValue(2026, 2, 28));
    expect(addMonths(dateValue(2026, 11, 15), 2)).toEqual(dateValue(2027, 1, 15));
  });

  it("addYears clamps Feb 29 on non-leap targets", () => {
    expect(addYears(dateValue(2024, 2, 29), 1)).toEqual(dateValue(2025, 2, 28));
  });

  it("compare/isSameDay order dates correctly", () => {
    expect(compareDates(dateValue(2026, 6, 12), dateValue(2026, 6, 13))).toBeLessThan(0);
    expect(isSameDay(dateValue(2026, 6, 12), dateValue(2026, 6, 12))).toBe(true);
    expect(isSameDay(null, dateValue(2026, 6, 12))).toBe(false);
  });

  it("clamp and range checks honour min/max", () => {
    const min = dateValue(2026, 6, 1);
    const max = dateValue(2026, 6, 30);
    expect(clampDate(dateValue(2026, 5, 20), min, max)).toEqual(min);
    expect(clampDate(dateValue(2026, 7, 2), min, max)).toEqual(max);
    expect(isDateInRange(dateValue(2026, 6, 15), min, max)).toBe(true);
    expect(isDateInRange(dateValue(2026, 7, 1), min, max)).toBe(false);
    expect(isBetween(dateValue(2026, 6, 15), dateValue(2026, 6, 20), dateValue(2026, 6, 10))).toBe(
      true,
    );
  });
});

describe("weeks", () => {
  // 2026-06-12 is a Friday (dayOfWeek 5).
  it("startOfWeek depends on the locale's first day", () => {
    expect(dayOfWeek(dateValue(2026, 6, 12))).toBe(5);
    expect(startOfWeek(dateValue(2026, 6, 12), 1)).toEqual(dateValue(2026, 6, 8)); // Monday
    expect(startOfWeek(dateValue(2026, 6, 12), 0)).toEqual(dateValue(2026, 6, 7)); // Sunday
    expect(startOfWeek(dateValue(2026, 6, 12), 6)).toEqual(dateValue(2026, 6, 6)); // Saturday
  });

  it("endOfWeek is six days after the start", () => {
    expect(endOfWeek(dateValue(2026, 6, 12), 1)).toEqual(dateValue(2026, 6, 14));
  });
});

describe("ISO keys", () => {
  it("round-trips and zero-pads", () => {
    expect(toISODate(dateValue(2026, 6, 2))).toBe("2026-06-02");
    expect(parseISODate("2026-06-02")).toEqual(dateValue(2026, 6, 2));
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("12/06/2026")).toBeNull();
  });
});

describe("monthGrid", () => {
  it("June 2026 with Monday first: 5 full weeks, padded with adjacent months", () => {
    const grid = monthGrid(2026, 6, 1);
    expect(grid).toHaveLength(5);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // June 1st 2026 is a Monday — no leading pad.
    expect(grid[0][0]).toEqual({ date: dateValue(2026, 6, 1), inMonth: true });
    // June 30th is a Tuesday — trailing pad belongs to July.
    const lastWeek = grid[4];
    expect(lastWeek[1].date).toEqual(dateValue(2026, 6, 30));
    expect(lastWeek[2]).toEqual({ date: dateValue(2026, 7, 1), inMonth: false });
  });

  it("first day of week shifts the padding", () => {
    const grid = monthGrid(2026, 6, 0); // Sunday first
    expect(grid[0][0]).toEqual({ date: dateValue(2026, 5, 31), inMonth: false });
    expect(grid[0][1].date).toEqual(dateValue(2026, 6, 1));
  });

  it("February of a non-leap year starting on the week's first day fits 4 weeks", () => {
    // Feb 2027 starts on Monday and has 28 days.
    const grid = monthGrid(2027, 2, 1);
    expect(grid).toHaveLength(4);
    expect(grid[0][0].date).toEqual(dateValue(2027, 2, 1));
    expect(grid[3][6].date).toEqual(dateValue(2027, 2, 28));
  });
});
