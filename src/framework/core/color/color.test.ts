// @vitest-environment node
// Wave 9c — core/color: exact conversions proven by round-trips over a grid
// of the RGB cube, hard-coded OKLab matrices checked against the published
// reference values, parsing/formatting round-trips, WCAG contrast and ΔEOK.
import { describe, expect, it } from "vitest";
import {
  deltaEOK,
  hslToRgb,
  hsvToRgb,
  oklchToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  type RgbColor,
} from "./convert";
import { formatHex, formatHsl, formatOklch, formatRgb, parseColor } from "./parse";
import { contrastRatio, relativeLuminance, wcagContrast } from "./contrast";
import { CSS_NAMED_COLORS, nearestNamedColor } from "./named";

const rgbGrid = (step: number): RgbColor[] => {
  const grid: RgbColor[] = [];
  for (let r = 0; r <= 255; r += step)
    for (let g = 0; g <= 255; g += step)
      for (let b = 0; b <= 255; b += step) grid.push({ r, g, b });
  return grid;
};

const expectRgbClose = (a: RgbColor, b: RgbColor, tolerance = 0.5) => {
  expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tolerance);
};

describe("RGB ↔ HSV ↔ HSL — round-trips over the cube", () => {
  const grid = rgbGrid(51); // 6³ = 216 colors

  it("rgb → hsv → rgb is exact", () => {
    for (const rgb of grid) expectRgbClose(hsvToRgb(rgbToHsv(rgb)), rgb, 1e-9);
  });

  it("rgb → hsl → rgb is exact", () => {
    for (const rgb of grid) expectRgbClose(hslToRgb(rgbToHsl(rgb)), rgb, 1e-6);
  });

  it("known anchors", () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 });
    expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, v: 100 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expectRgbClose(hsvToRgb({ h: 300, s: 100, v: 100 }), { r: 255, g: 0, b: 255 }, 1e-9);
  });
});

describe("sRGB ↔ OKLCH — hard-coded matrices, reference values", () => {
  it("matches the published OKLab reference for white and red", () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeCloseTo(0, 3);

    // sRGB red: L ≈ 0.6280, C ≈ 0.2577, H ≈ 29.23° (Ottosson's tables).
    const red = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.2577, 2);
    expect(red.h).toBeCloseTo(29.23, 0);
  });

  it("rgb → oklch → rgb round-trips under 1/255 over the cube", () => {
    for (const rgb of rgbGrid(51)) {
      expectRgbClose(oklchToRgb(rgbToOklch(rgb)), rgb, 1);
    }
  });

  it("black has zero chroma and stable hue 0", () => {
    expect(rgbToOklch({ r: 0, g: 0, b: 0 })).toEqual({ l: 0, c: 0, h: 0 });
  });
});

describe("parsing & formatting — round-trips", () => {
  it("hex in all four lengths", () => {
    expect(parseColor("#f00")).toEqual({ rgb: { r: 255, g: 0, b: 0 }, alpha: 1 });
    expect(parseColor("#f008")?.alpha).toBeCloseTo(0x88 / 255, 5);
    expect(parseColor("#1e90ff")).toEqual({ rgb: { r: 30, g: 144, b: 255 }, alpha: 1 });
    expect(parseColor("#1e90ff80")?.alpha).toBeCloseTo(0.502, 2);
    expect(parseColor("zzz")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
  });

  it("rgb() — legacy commas, modern spaces, % channels, both alpha forms", () => {
    expect(parseColor("rgb(30, 144, 255)")?.rgb).toEqual({ r: 30, g: 144, b: 255 });
    expect(parseColor("rgb(30 144 255 / 0.5)")?.alpha).toBe(0.5);
    expect(parseColor("rgba(30, 144, 255, 50%)")?.alpha).toBe(0.5);
    expect(parseColor("rgb(100% 0% 0%)")?.rgb).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("rgb(1 2)")).toBeNull();
  });

  it("hsl() and oklch()", () => {
    expectRgbClose(parseColor("hsl(240, 100%, 50%)")!.rgb, { r: 0, g: 0, b: 255 }, 1e-6);
    expect(parseColor("hsl(240 100% 50% / 25%)")?.alpha).toBe(0.25);
    const red = parseColor("oklch(0.628 0.2577 29.23)")!.rgb;
    expectRgbClose(red, { r: 255, g: 0, b: 0 }, 1);
    expect(parseColor("oklch(62.8% 0.2577 29.23deg)")).not.toBeNull();
  });

  it("parse(format(x)) round-trips for every formatter", () => {
    const colors: [RgbColor, number][] = [
      [{ r: 30, g: 144, b: 255 }, 1],
      [{ r: 163, g: 42, b: 7 }, 0.5],
      [{ r: 0, g: 0, b: 0 }, 1],
      [{ r: 255, g: 255, b: 255 }, 0.25],
    ];
    for (const [rgb, alpha] of colors) {
      for (const format of [formatHex, formatRgb, formatHsl, formatOklch]) {
        const parsed = parseColor(format(rgb, alpha));
        expect(parsed).not.toBeNull();
        expectRgbClose(parsed!.rgb, rgb, 1);
        expect(parsed!.alpha).toBeCloseTo(alpha, 2);
      }
    }
  });

  it("formats match CSS syntax", () => {
    expect(formatHex({ r: 30, g: 144, b: 255 })).toBe("#1e90ff");
    expect(formatHex({ r: 255, g: 0, b: 0 }, 0.5)).toBe("#ff000080");
    expect(formatRgb({ r: 30, g: 144, b: 255 }, 0.5)).toBe("rgb(30 144 255 / 0.5)");
    expect(formatHsl({ r: 0, g: 0, b: 255 })).toBe("hsl(240 100% 50%)");
  });
});

describe("WCAG contrast", () => {
  it("anchors: black/white = 21, self = 1", () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5); // order-independent
    expect(contrastRatio(black, black)).toBe(1);
    expect(relativeLuminance(white)).toBeCloseTo(1, 9);
  });

  it("thresholds: #767676 on white passes AA, not AAA", () => {
    const gray = { r: 0x76, g: 0x76, b: 0x76 };
    const white = { r: 255, g: 255, b: 255 };
    const verdict = wcagContrast(gray, white);
    expect(verdict.ratio).toBeGreaterThanOrEqual(4.5);
    expect(verdict.aaNormal).toBe(true);
    expect(verdict.aaaNormal).toBe(false);
    expect(verdict.aaLarge).toBe(true);
  });
});

describe("ΔEOK & named colors (leaf module)", () => {
  it("ΔE is 0 for identical colors and grows with distance", () => {
    const red = { r: 255, g: 0, b: 0 };
    expect(deltaEOK(red, red)).toBe(0);
    const nearRed = deltaEOK(red, { r: 250, g: 5, b: 5 });
    const farBlue = deltaEOK(red, { r: 0, g: 0, b: 255 });
    expect(nearRed).toBeLessThan(0.02);
    expect(farBlue).toBeGreaterThan(0.2);
  });

  it("the table is the full CSS Color 4 set (148 names, valid hex)", () => {
    const entries = Object.entries(CSS_NAMED_COLORS);
    expect(entries).toHaveLength(148);
    for (const [, hex] of entries) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(CSS_NAMED_COLORS.rebeccapurple).toBe("#663399");
    expect(CSS_NAMED_COLORS.cornflowerblue).toBe("#6495ed");
  });

  it("nearestNamedColor: exact hits and close misses", () => {
    expect(nearestNamedColor({ r: 255, g: 0, b: 0 })).toMatchObject({ name: "red", exact: true });
    const close = nearestNamedColor({ r: 252, g: 4, b: 2 });
    expect(close.name).toBe("red");
    expect(close.exact).toBe(false);
    expect(close.deltaE).toBeLessThan(0.02);
    expect(nearestNamedColor({ r: 100, g: 51, b: 153 }).name).toBe("rebeccapurple");
  });
});
