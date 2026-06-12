// @vitest-environment node
// Time-picker pure geometry & option policies — columns, wheel snap, dial.
import { describe, expect, it } from "vitest";
import { timeValue } from "./value";
import {
  angleForValue,
  dayPeriodOptions,
  dialHourFromPoint,
  dialMinuteFromPoint,
  hourAngle,
  hourOnInnerRing,
  hourOptions,
  minuteAngle,
  minuteOptions,
  minuteSteps,
  nearestEnabledOption,
  pointToAngle,
  snapAngleToValues,
  wheelIndexForOffset,
  wheelOffsetForIndex,
  wheelSettle,
  type TimePickerOptionsConfig,
} from "./picker";

const H23: TimePickerOptionsConfig = { hourCycle: "h23" };
const H12: TimePickerOptionsConfig = { hourCycle: "h12" };

describe("column options — minute step, bounds, disabled times", () => {
  it("minuteSteps spans the hour at the configured granularity", () => {
    expect(minuteSteps(15)).toEqual([0, 15, 30, 45]);
    expect(minuteSteps(1)).toHaveLength(60);
    expect(minuteSteps(7)).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56]);
  });

  it("hour options follow the display cycle (0-23 fr, 1-12 en-US)", () => {
    expect(hourOptions(H23).map((o) => o.value)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(hourOptions(H12).map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("min/max disable hours with no reachable minute, and minutes per hour", () => {
    const office: TimePickerOptionsConfig = {
      hourCycle: "h23",
      min: timeValue(9, 30),
      max: timeValue(17, 0),
    };
    const hours = hourOptions(office);
    expect(hours.find((o) => o.value === 8)?.disabled).toBe(true);
    expect(hours.find((o) => o.value === 9)?.disabled).toBe(false); // 9:30 reachable
    expect(hours.find((o) => o.value === 17)?.disabled).toBe(false); // exactly 17:00
    expect(hours.find((o) => o.value === 18)?.disabled).toBe(true);
    const at9 = minuteOptions(office, 9);
    expect(at9.find((o) => o.value === 0)?.disabled).toBe(true);
    expect(at9.find((o) => o.value === 30)?.disabled).toBe(false);
    const at17 = minuteOptions(office, 17);
    expect(at17.find((o) => o.value === 0)?.disabled).toBe(false);
    expect(at17.find((o) => o.value === 30)?.disabled).toBe(true);
  });

  it("isTimeDisabled is evaluated per concrete time (lunch break)", () => {
    const noLunch: TimePickerOptionsConfig = {
      hourCycle: "h23",
      isTimeDisabled: (t) => t.hour === 12,
    };
    expect(hourOptions(noLunch).find((o) => o.value === 12)?.disabled).toBe(true);
    expect(minuteOptions(noLunch, 12).every((o) => o.disabled)).toBe(true);
    expect(minuteOptions(noLunch, 13).every((o) => !o.disabled)).toBe(true);
  });

  it("a day period is disabled when its whole half-day is out of bounds", () => {
    const evening: TimePickerOptionsConfig = {
      hourCycle: "h12",
      min: timeValue(14, 0),
    };
    const periods = dayPeriodOptions(evening);
    expect(periods).toEqual([
      { value: 0, disabled: true },
      { value: 1, disabled: false },
    ]);
    expect(dayPeriodOptions(H23)).toEqual([]); // no dayPeriod in 24-hour cycles
  });
});

describe("wheel — offset → index snap with inertia projection", () => {
  it("never settles on a disabled option (nearest enabled wins, clamped)", () => {
    const options = [
      { value: 0, disabled: true },
      { value: 1, disabled: false },
      { value: 2, disabled: true },
      { value: 3, disabled: false },
    ];
    expect(nearestEnabledOption(options, 0)).toBe(1);
    expect(nearestEnabledOption(options, 2)).toBe(1); // ties resolve downward
    expect(nearestEnabledOption(options, 9)).toBe(3); // clamped into the list
    expect(nearestEnabledOption([{ value: 0, disabled: true }], 0)).toBeNull();
  });

  it("rounds to the nearest item and clamps to the list", () => {
    expect(wheelIndexForOffset(0, 40, 24)).toBe(0);
    expect(wheelIndexForOffset(59, 40, 24)).toBe(1);
    expect(wheelIndexForOffset(61, 40, 24)).toBe(2);
    expect(wheelIndexForOffset(-50, 40, 24)).toBe(0);
    expect(wheelIndexForOffset(10_000, 40, 24)).toBe(23);
    expect(wheelOffsetForIndex(5, 40)).toBe(200);
  });

  it("a flick coasts (v²/2a) then snaps; release without speed snaps in place", () => {
    const still = wheelSettle(85, 0, 40, 24);
    expect(still.index).toBe(2);
    expect(still.offset).toBe(80);
    const flick = wheelSettle(80, 1.2, 40, 24); // coasts 240px → 6 items
    expect(flick.index).toBe(8);
    const back = wheelSettle(80, -1.2, 40, 24);
    expect(back.index).toBe(0); // clamped at the top
  });
});

describe("dial — angle ↔ value geometry", () => {
  it("pointToAngle: 0° at 12 o'clock, clockwise (screen y down)", () => {
    expect(pointToAngle(0, -1)).toBe(0); // up
    expect(pointToAngle(1, 0)).toBe(90); // right = 3 o'clock
    expect(pointToAngle(0, 1)).toBe(180); // down = 6 o'clock
    expect(pointToAngle(-1, 0)).toBe(270); // left = 9 o'clock
  });

  it("value ↔ angle round-trips on both dials", () => {
    expect(hourAngle(3)).toBe(90);
    expect(hourAngle(15)).toBe(90); // 24h storage folds onto the 12 ring
    expect(minuteAngle(30)).toBe(180);
    expect(angleForValue(45, 60)).toBe(270);
  });

  it("snapAngleToValues uses true circular distance (step gaps near 12 o'clock)", () => {
    expect(snapAngleToValues(359, [0, 15, 30, 45], 60)).toBe(0); // wraps past the top
    expect(dialMinuteFromPoint(0.1, -1, 15)).toBe(0);
    expect(dialMinuteFromPoint(1, 0.05, 5)).toBe(15); // ~3 o'clock
  });

  it("magnetism: minutes snap to the configured step", () => {
    // 97° ≈ minute 16.2 — snaps to 15 with step 5, to 16 with step 1.
    const dx = Math.sin((97 * Math.PI) / 180);
    const dy = -Math.cos((97 * Math.PI) / 180);
    expect(dialMinuteFromPoint(dx, dy, 5)).toBe(15);
    expect(dialMinuteFromPoint(dx, dy, 1)).toBe(16);
  });

  it("h12 dial: single ring + dayPeriod → storage hour", () => {
    expect(dialHourFromPoint(0, -1, 1, "h12", 0)).toBe(0); // 12 AM = midnight
    expect(dialHourFromPoint(0, -1, 1, "h12", 1)).toBe(12); // 12 PM = noon
    expect(dialHourFromPoint(1, 0, 1, "h12", 0)).toBe(3);
    expect(dialHourFromPoint(1, 0, 1, "h12", 1)).toBe(15);
  });

  it("h23 dial: outer ring 1-12, inner ring 13-00 by distance ratio", () => {
    expect(dialHourFromPoint(1, 0, 0.95, "h23")).toBe(3); // outer, 3 o'clock
    expect(dialHourFromPoint(1, 0, 0.4, "h23")).toBe(15); // inner, 3 o'clock
    expect(dialHourFromPoint(0, -1, 0.95, "h23")).toBe(12); // outer top = noon
    expect(dialHourFromPoint(0, -1, 0.4, "h23")).toBe(0); // inner top = midnight
    expect(hourOnInnerRing(0, "h23")).toBe(true);
    expect(hourOnInnerRing(15, "h23")).toBe(true);
    expect(hourOnInnerRing(9, "h23")).toBe(false);
    expect(hourOnInnerRing(15, "h12")).toBe(false); // 12-hour dials have one ring
  });
});
