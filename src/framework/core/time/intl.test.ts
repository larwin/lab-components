// @vitest-environment node
// Time intl services — hour cycle, field structure and labels all from Intl.
import { describe, expect, it } from "vitest";
import { timeValue } from "./value";
import { dayPeriodLabels, formatTime, hourCycleOf, timeFieldParts, timeUnitLabel } from "./intl";

describe("hour cycle — derived from Intl, never guessed", () => {
  it("en-US is 12-hour, fr is 23-hour", () => {
    expect(hourCycleOf("en-US")).toBe("h12");
    expect(hourCycleOf("fr")).toBe("h23");
    expect(hourCycleOf("de")).toBe("h23");
  });
});

describe("time field parts — locale order from formatToParts", () => {
  const editable = (locale: string, opts?: { seconds?: boolean }) =>
    timeFieldParts(locale, opts)
      .filter((p) => p.type !== "literal")
      .map((p) => p.type);

  it("en-US: hour, minute, dayPeriod — fr: hour, minute, no dayPeriod", () => {
    expect(editable("en-US")).toEqual(["hour", "minute", "dayPeriod"]);
    expect(editable("fr")).toEqual(["hour", "minute"]);
  });

  it("seconds are opt-in and slot before the dayPeriod", () => {
    expect(editable("en-US", { seconds: true })).toEqual(["hour", "minute", "second", "dayPeriod"]);
    expect(editable("fr", { seconds: true })).toEqual(["hour", "minute", "second"]);
  });

  it("keeps the locale's literal separators", () => {
    const fr = timeFieldParts("fr");
    expect(fr.some((p) => p.type === "literal" && p.value === ":")).toBe(true);
  });
});

describe("day-period labels & formatting", () => {
  it("yields localized AM/PM even for 24-hour locales (forced h12)", () => {
    expect(dayPeriodLabels("en-US")).toEqual(["AM", "PM"]);
    const fr = dayPeriodLabels("fr");
    expect(fr).toHaveLength(2);
    expect(fr[0]).not.toBe(fr[1]);
  });

  it("formats through Intl with the locale's cycle", () => {
    expect(formatTime(timeValue(14, 5), "en-US")).toMatch(/2:05/);
    expect(formatTime(timeValue(14, 5), "fr")).toMatch(/14:05/);
    expect(formatTime(timeValue(14, 5, 9), "fr")).toMatch(/14:05:09/);
  });

  it("localizes segment unit labels via Intl.DisplayNames", () => {
    expect(timeUnitLabel("hour", "fr").toLowerCase()).toContain("heure");
    expect(timeUnitLabel("minute", "en")).toBeTruthy();
  });
});
