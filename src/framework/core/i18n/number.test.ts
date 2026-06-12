// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatNumber, parseNumber } from "./number";

describe("formatNumber", () => {
  it("formats per locale", () => {
    expect(formatNumber(1234.56, "en-US")).toBe("1,234.56");
    // fr-FR uses U+202F (narrow no-break space) as group separator.
    expect(formatNumber(1234.56, "fr-FR").replace(/[\s  ]/g, " ")).toBe("1 234,56");
  });

  it("supports Intl options (currency, percent)", () => {
    expect(formatNumber(0.5, "en-US", { style: "percent" })).toBe("50%");
    expect(formatNumber(9.99, "en-US", { style: "currency", currency: "USD" })).toBe("$9.99");
  });
});

describe("parseNumber", () => {
  it("round-trips the locale's own format", () => {
    expect(parseNumber(formatNumber(1234.56, "fr-FR"), "fr-FR")).toBe(1234.56);
    expect(parseNumber(formatNumber(1234.56, "en-US"), "en-US")).toBe(1234.56);
    expect(parseNumber(formatNumber(-42.5, "de-DE"), "de-DE")).toBe(-42.5);
  });

  it("parses plain and locale-decorated input", () => {
    expect(parseNumber("12.5", "en-US")).toBe(12.5);
    expect(parseNumber("12,5", "fr-FR")).toBe(12.5);
    expect(parseNumber("1 234,56", "fr-FR")).toBe(1234.56);
    expect(parseNumber("-7", "en-US")).toBe(-7);
  });

  it("tolerates currency symbols and spaces", () => {
    expect(parseNumber("9,99 €", "fr-FR")).toBe(9.99);
    expect(parseNumber("$1,000", "en-US")).toBe(1000);
  });

  it("percent style stores the raw ratio", () => {
    expect(parseNumber("50 %", "fr-FR", { style: "percent" })).toBe(0.5);
  });

  it("returns null when there is no number", () => {
    expect(parseNumber("", "en-US")).toBeNull();
    expect(parseNumber("abc", "en-US")).toBeNull();
    expect(parseNumber("-", "en-US")).toBeNull();
  });
});
