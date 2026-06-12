// @vitest-environment node
// TimeValue — pure wall-clock arithmetic, hour cycles, date-time composition.
import { describe, expect, it } from "vitest";
import { dateValue } from "../date/value";
import {
  addDateTimeMinutes,
  addHours,
  addMinutes,
  addSeconds,
  clampTime,
  combineDateTime,
  compareDateTimes,
  compareTimes,
  dayPeriodOf,
  displayHour,
  fromSecondsOfDay,
  hourBounds,
  hourFromDisplay,
  isSameTime,
  isTimeInRange,
  parseISOTime,
  roundToMinuteStep,
  timeValue,
  toISODateTime,
  toISOTime,
  toSecondsOfDay,
  usesDayPeriod,
  type HourCycle,
} from "./value";

describe("time value — wrap arithmetic", () => {
  it("wraps across midnight: 23:59 + 1 min = 00:00", () => {
    expect(addMinutes(timeValue(23, 59), 1)).toEqual(timeValue(0, 0));
    expect(addMinutes(timeValue(0, 0), -1)).toEqual(timeValue(23, 59));
    expect(addHours(timeValue(22, 30), 4)).toEqual(timeValue(2, 30));
  });

  it("preserves the presence (and absence) of seconds", () => {
    expect(addMinutes(timeValue(10, 0), 5)).not.toHaveProperty("second");
    expect(addMinutes(timeValue(10, 0, 30), 5)).toEqual(timeValue(10, 5, 30));
    expect(addSeconds(timeValue(23, 59, 59), 1)).toEqual(timeValue(0, 0, 0));
  });

  it("round-trips seconds-of-day", () => {
    expect(toSecondsOfDay(timeValue(14, 5, 9))).toBe(14 * 3600 + 5 * 60 + 9);
    expect(fromSecondsOfDay(toSecondsOfDay(timeValue(14, 5, 9)), true)).toEqual(
      timeValue(14, 5, 9),
    );
    expect(fromSecondsOfDay(-60)).toEqual(timeValue(23, 59));
  });

  it("compares, clamps and ranges on the seconds axis", () => {
    expect(compareTimes(timeValue(9, 0), timeValue(17, 30))).toBeLessThan(0);
    expect(isSameTime(timeValue(9, 0, 0), timeValue(9, 0))).toBe(true); // second 0 == absent
    expect(clampTime(timeValue(7, 0), timeValue(9, 0), timeValue(18, 0))).toEqual(timeValue(9, 0));
    expect(isTimeInRange(timeValue(12, 0), timeValue(9, 0), timeValue(18, 0))).toBe(true);
    expect(isTimeInRange(timeValue(20, 0), timeValue(9, 0), timeValue(18, 0))).toBe(false);
  });

  it("rounds to a minute step, wrapping at the end of day", () => {
    expect(roundToMinuteStep(timeValue(10, 7), 5)).toEqual(timeValue(10, 5));
    expect(roundToMinuteStep(timeValue(10, 8), 5)).toEqual(timeValue(10, 10));
    expect(roundToMinuteStep(timeValue(23, 58), 15)).toEqual(timeValue(0, 0));
  });

  it("serializes to sortable ISO and parses it back", () => {
    expect(toISOTime(timeValue(9, 5))).toBe("09:05");
    expect(toISOTime(timeValue(9, 5, 7))).toBe("09:05:07");
    expect(parseISOTime("14:05")).toEqual(timeValue(14, 5));
    expect(parseISOTime("14:05:09")).toEqual(timeValue(14, 5, 9));
    expect(parseISOTime("24:00")).toBeNull();
    expect(parseISOTime("9:05")).toBeNull();
  });
});

describe("time value — hour cycles", () => {
  it("derives display bounds and day-period usage per cycle", () => {
    expect(hourBounds("h12")).toEqual({ min: 1, max: 12 });
    expect(hourBounds("h23")).toEqual({ min: 0, max: 23 });
    expect(usesDayPeriod("h12")).toBe(true);
    expect(usesDayPeriod("h23")).toBe(false);
  });

  it("converts 24-hour storage to display hours (midnight is 12 AM in h12)", () => {
    expect(displayHour(0, "h12")).toBe(12);
    expect(displayHour(14, "h12")).toBe(2);
    expect(displayHour(12, "h12")).toBe(12);
    expect(displayHour(0, "h11")).toBe(0);
    expect(displayHour(14, "h23")).toBe(14);
    expect(displayHour(0, "h24")).toBe(24);
  });

  it("round-trips every hour of the day through every cycle", () => {
    const cycles: HourCycle[] = ["h11", "h12", "h23", "h24"];
    for (const cycle of cycles) {
      for (let hour = 0; hour < 24; hour++) {
        const display = displayHour(hour, cycle);
        expect(hourFromDisplay(display, dayPeriodOf(hour), cycle)).toBe(hour);
      }
    }
  });
});

describe("date-time value — flat civil composition", () => {
  it("combines, splits and compares date + time", () => {
    const dt = combineDateTime(dateValue(2026, 6, 12), timeValue(14, 30));
    expect(dt).toEqual({ year: 2026, month: 6, day: 12, hour: 14, minute: 30 });
    expect(
      compareDateTimes(dt, combineDateTime(dateValue(2026, 6, 12), timeValue(15, 0))),
    ).toBeLessThan(0);
    expect(toISODateTime(dt)).toBe("2026-06-12T14:30");
  });

  it("rolls the civil date across midnight", () => {
    const dt = combineDateTime(dateValue(2026, 12, 31), timeValue(23, 30));
    expect(addDateTimeMinutes(dt, 45)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      hour: 0,
      minute: 15,
    });
    expect(addDateTimeMinutes(addDateTimeMinutes(dt, 45), -45)).toEqual(dt);
  });
});
