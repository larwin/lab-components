// @vitest-environment node
// Windows ↔ IANA mapping — generated from CLDR windowsZones, optional module.
import { describe, expect, it } from "vitest";
import { ianaFromWindows, windowsFromIana, windowsTimeZoneIds } from "./windows-zones";

describe("windows-zones — CLDR-generated, territory-aware", () => {
  it("maps Windows ids to their canonical IANA zone (territory 001)", () => {
    expect(ianaFromWindows("Romance Standard Time")).toBe("Europe/Paris");
    expect(ianaFromWindows("Eastern Standard Time")).toBe("America/New_York");
    expect(ianaFromWindows("Tokyo Standard Time")).toBe("Asia/Tokyo");
    expect(ianaFromWindows("Nonexistent Standard Time")).toBeNull();
  });

  it("resolves per-territory variants, falling back to 001", () => {
    expect(ianaFromWindows("Romance Standard Time", "BE")).toBe("Europe/Brussels");
    expect(ianaFromWindows("Romance Standard Time", "ZZ")).toBe("Europe/Paris"); // fallback
  });

  it("reverses IANA → Windows, links included", () => {
    expect(windowsFromIana("Europe/Paris")).toBe("Romance Standard Time");
    expect(windowsFromIana("Europe/Brussels")).toBe("Romance Standard Time");
    expect(windowsFromIana("Asia/Tokyo")).toBe("Tokyo Standard Time");
    expect(windowsFromIana("Not/A_Zone")).toBeNull();
  });

  it("exposes the full Windows id list for pickers", () => {
    const ids = windowsTimeZoneIds();
    expect(ids.length).toBeGreaterThan(100);
    expect(ids).toContain("UTC");
  });
});
