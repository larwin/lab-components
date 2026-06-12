// @vitest-environment node
// ZonedDateTime — offsets computed via Intl, DST correct by construction.
import { describe, expect, it } from "vitest";
import { dateValue } from "../date/value";
import { timeValue } from "./value";
import {
  addZonedDays,
  addZonedMinutes,
  epochOf,
  formatOffset,
  instantFromZoned,
  supportedTimeZones,
  timeZoneCity,
  timeZoneName,
  withTimeZone,
  zonedDateTime,
  zonedFromInstant,
  zoneOffset,
} from "./zone";

const PARIS = "Europe/Paris";
const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("zone offsets — computed from Intl, never shipped", () => {
  it("Paris is +60 in winter and +120 in summer (DST by construction)", () => {
    const winter = epochOf(zonedDateTime(dateValue(2026, 1, 15), timeValue(12, 0), PARIS));
    const summer = epochOf(zonedDateTime(dateValue(2026, 7, 15), timeValue(12, 0), PARIS));
    expect(zoneOffset(winter, PARIS)).toBe(60);
    expect(zoneOffset(summer, PARIS)).toBe(120);
    expect(zoneOffset(winter, NY)).toBe(-300);
    expect(zoneOffset(summer, NY)).toBe(-240);
    expect(zoneOffset(summer, TOKYO)).toBe(540); // no DST in Japan
    expect(zoneOffset(summer, "Asia/Kolkata")).toBe(330); // half-hour offsets parse too
  });

  it("round-trips instant ↔ fields in any zone", () => {
    const zdt = zonedDateTime(dateValue(2026, 7, 15), timeValue(18, 0), PARIS);
    expect(zdt).toMatchObject({ year: 2026, month: 7, day: 15, hour: 18, offsetMinutes: 120 });
    expect(zonedFromInstant(epochOf(zdt), PARIS)).toEqual(zdt);
  });
});

describe("same instant, three cities — the converter", () => {
  it("summer: Paris 18:00 = New York 12:00 = Tokyo 01:00 (+1 day)", () => {
    const paris = zonedDateTime(dateValue(2026, 7, 15), timeValue(18, 0), PARIS);
    const ny = withTimeZone(paris, NY);
    const tokyo = withTimeZone(paris, TOKYO);
    expect(ny).toMatchObject({ day: 15, hour: 12, offsetMinutes: -240 });
    expect(tokyo).toMatchObject({ day: 16, hour: 1, offsetMinutes: 540 });
    expect(epochOf(ny)).toBe(epochOf(paris)); // same instant, by definition
  });

  it("winter: Tokyo shifts to 02:00 — Europe dropped DST, Japan never had it", () => {
    const paris = zonedDateTime(dateValue(2026, 1, 15), timeValue(18, 0), PARIS);
    expect(withTimeZone(paris, TOKYO)).toMatchObject({ day: 16, hour: 2 });
    expect(withTimeZone(paris, NY)).toMatchObject({ day: 15, hour: 12 });
  });
});

describe("DST transitions — gap and overlap resolve the Temporal-compatible way", () => {
  it("spring-forward gap: Paris 2026-03-29 02:30 does not exist → lands at 03:30", () => {
    const resolved = zonedFromInstant(
      instantFromZoned({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, PARIS),
      PARIS,
    );
    expect(resolved).toMatchObject({ hour: 3, minute: 30, offsetMinutes: 120 });
  });

  it("fall-back overlap: Paris 2026-10-25 02:30 exists twice → the EARLIER instant wins", () => {
    const resolved = zonedFromInstant(
      instantFromZoned({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, PARIS),
      PARIS,
    );
    expect(resolved).toMatchObject({ hour: 2, minute: 30, offsetMinutes: 120 }); // still summer
  });

  it("adding a day keeps the WALL time across the transition (23-hour day)", () => {
    const before = zonedDateTime(dateValue(2026, 3, 28), timeValue(9, 0), PARIS);
    const after = addZonedDays(before, 1);
    expect(after).toMatchObject({ day: 29, hour: 9, minute: 0, offsetMinutes: 120 });
    expect(epochOf(after) - epochOf(before)).toBe(23 * 3600 * 1000); // exact hours: 23
  });

  it("adding exact minutes crosses the gap on the wall clock", () => {
    const before = zonedDateTime(dateValue(2026, 3, 29), timeValue(1, 30), PARIS);
    const after = addZonedMinutes(before, 120);
    expect(after).toMatchObject({ hour: 4, minute: 30 }); // 01:30 + 2h real = 04:30 wall
  });
});

describe("zone directory — list and labels from Intl", () => {
  it("lists IANA zones and extracts cities", () => {
    const zones = supportedTimeZones();
    expect(zones).toContain("Europe/Paris");
    expect(zones).toContain("America/New_York");
    expect(timeZoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });

  it("localizes zone names and formats offsets stably", () => {
    expect(timeZoneName(PARIS, "en", "long")).toMatch(/Europe/);
    expect(timeZoneName(PARIS, "fr", "long").length).toBeGreaterThan(3);
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(formatOffset(-300)).toBe("UTC−05:00");
    expect(formatOffset(0)).toBe("UTC+00:00");
  });
});
