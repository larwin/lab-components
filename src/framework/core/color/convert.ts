/**
 * Color conversions — exact, dependency-free, Node-testable.
 *
 * RGB ↔ HSL ↔ HSV are closed-form. sRGB ↔ OKLCH goes through linear sRGB and
 * Björn Ottosson's OKLab matrices (hard-coded below, the reference values
 * from the OKLab publication) — round-trips are exact to under 1/255 over
 * the full RGB cube (proven in color.test.ts).
 *
 * Conventions: r/g/b in 0-255 (fractional allowed — formatters round),
 * h in 0-360, s/l/v in 0-100, OKLCH l in 0-1, alpha in 0-1.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/** The picker's working state: HSV + alpha (hue survives s = 0 or v = 0). */
export interface HsvaColor extends HsvColor {
  a: number;
}

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const clampRgb = (rgb: RgbColor): RgbColor => ({
  r: Math.min(255, Math.max(0, rgb.r)),
  g: Math.min(255, Math.max(0, rgb.g)),
  b: Math.min(255, Math.max(0, rgb.b)),
});

const normalizeHue = (h: number): number => ((h % 360) + 360) % 360;

/* ------------------------------ RGB ↔ HSV ------------------------------ */

export function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  return {
    h: normalizeHue(h),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

export function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const sn = clamp01(s / 100);
  const vn = clamp01(v / 100);
  const hh = normalizeHue(h) / 60;
  const c = vn * sn;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = vn - c;
  const sector = Math.floor(hh) % 6;
  const [rn, gn, bn] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

/* ------------------------------ RGB ↔ HSL ------------------------------ */

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const { h, s, v } = rgbToHsv({ r, g, b });
  const vn = v / 100;
  const sn = s / 100;
  const l = vn * (1 - sn / 2);
  const sl = l === 0 || l === 1 ? 0 : (vn - l) / Math.min(l, 1 - l);
  return { h, s: sl * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const ln = clamp01(l / 100);
  const sn = clamp01(s / 100);
  const v = ln + sn * Math.min(ln, 1 - ln);
  const sv = v === 0 ? 0 : 2 * (1 - ln / v);
  return hsvToRgb({ h, s: sv * 100, v: v * 100 });
}

/* ----------------------------- sRGB ↔ OKLCH ----------------------------- */

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (linear: number): number => {
  const c = clamp01(linear);
  return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
};

export interface OklabColor {
  l: number;
  a: number;
  b: number;
}

/** Linear sRGB → OKLab (Ottosson reference matrices). */
export function rgbToOklab(rgb: RgbColor): OklabColor {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ l: L, a, b }: OklabColor): RgbColor {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function rgbToOklch(rgb: RgbColor): OklchColor {
  const { l, a, b } = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  // Hue is meaningless at zero chroma: report 0 (stable formatting).
  const h = c < 1e-7 ? 0 : normalizeHue((Math.atan2(b, a) * 180) / Math.PI);
  return { l, c, h };
}

export function oklchToRgb({ l, c, h }: OklchColor): RgbColor {
  const rad = (normalizeHue(h) * Math.PI) / 180;
  return oklabToRgb({ l, a: c * Math.cos(rad), b: c * Math.sin(rad) });
}

/* -------------------------------- ΔE OK -------------------------------- */

/**
 * Perceptual distance in OKLab (Euclidean — "ΔEOK"). Two colors closer than
 * ~0.02 read as the same; the picker uses it for "close to <named color>"
 * announcements.
 */
export function deltaEOK(a: RgbColor, b: RgbColor): number {
  const la = rgbToOklab(a);
  const lb = rgbToOklab(b);
  return Math.hypot(la.l - lb.l, la.a - lb.a, la.b - lb.b);
}
