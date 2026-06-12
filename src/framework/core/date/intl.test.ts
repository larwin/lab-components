// @vitest-environment node
// Intl-derived locale services — proves fr/en/ar without shipping locale data.
import { describe, expect, it } from "vitest";
import { dateValue } from "./value";
import { firstDayOfWeek, formatDate, formatMonthYear, monthNames, weekdayNames } from "./intl";

describe("firstDayOfWeek", () => {
  it("Monday for France, Sunday for the US, Saturday for Egypt", () => {
    expect(firstDayOfWeek("fr-FR")).toBe(1);
    expect(firstDayOfWeek("en-US")).toBe(0);
    expect(firstDayOfWeek("ar-EG")).toBe(6);
  });

  it("language-only tags resolve through their likely region", () => {
    expect(firstDayOfWeek("fr")).toBe(1);
    expect(firstDayOfWeek("ja")).toBe(0);
  });
});

describe("names & formatting", () => {
  it("weekday names are indexed 0=Sunday … 6=Saturday", () => {
    expect(weekdayNames("fr", "long")[0]).toBe("dimanche");
    expect(weekdayNames("fr", "long")[1]).toBe("lundi");
    expect(weekdayNames("en", "long")[6]).toBe("Saturday");
  });

  it("month names are localized", () => {
    expect(monthNames("fr")[0]).toBe("janvier");
    expect(monthNames("en")[11]).toBe("December");
  });

  it("formatMonthYear localizes the calendar header", () => {
    expect(formatMonthYear(2026, 6, "fr")).toBe("juin 2026");
    expect(formatMonthYear(2026, 6, "en")).toBe("June 2026");
    // Arabic uses its own digits — the year must not be "2026" verbatim.
    expect(formatMonthYear(2026, 6, "ar-EG")).toContain("يونيو");
  });

  it("formatDate renders a full localized date from a pure DateValue", () => {
    expect(formatDate(dateValue(2026, 6, 12), "fr", { dateStyle: "full" })).toBe(
      "vendredi 12 juin 2026",
    );
    expect(formatDate(dateValue(2026, 6, 12), "en-US", { dateStyle: "full" })).toBe(
      "Friday, June 12, 2026",
    );
  });

  it("years 0-99 stay exact (no 19xx remapping through the Date carrier)", () => {
    expect(formatDate(dateValue(99, 1, 1), "en", { year: "numeric" })).toBe("99");
  });
});
