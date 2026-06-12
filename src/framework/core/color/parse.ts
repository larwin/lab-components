import { clampRgb, hslToRgb, oklchToRgb, rgbToHsl, rgbToOklch, type RgbColor } from "./convert";

/**
 * Color parsing & formatting — hex, rgb(), hsl(), oklch(), both legacy
 * comma syntax and modern space syntax, alpha as "/ 0.5" or "/ 50%".
 * Round-trips (`parseColor(formatX(c)) ≈ c`) are Node-tested.
 */

export interface ParsedColor {
  rgb: RgbColor;
  /** 0-1. */
  alpha: number;
}

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const parseHex = (input: string): ParsedColor | null => {
  if (!HEX_PATTERN.test(input)) return null;
  let hex = input.slice(1);
  if (hex.length <= 4) {
    hex = [...hex].map((c) => c + c).join("");
  }
  const value = Number.parseInt(hex.slice(0, 6), 16);
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return {
    rgb: { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff },
    alpha,
  };
};

/** "50%" → 0.5 against `scale`, plain numbers pass through. */
const parseComponent = (token: string, percentScale: number): number | null => {
  const isPercent = token.endsWith("%");
  const raw = Number.parseFloat(isPercent ? token.slice(0, -1) : token);
  if (Number.isNaN(raw)) return null;
  return isPercent ? (raw / 100) * percentScale : raw;
};

const parseAlphaToken = (token: string | undefined): number | null => {
  if (token === undefined) return 1;
  const value = parseComponent(token, 1);
  if (value === null) return null;
  return Math.min(1, Math.max(0, value));
};

const splitArgs = (body: string): { args: string[]; alphaToken?: string } => {
  const [main, alphaPart] = body.split("/").map((s) => s.trim());
  const args = main.split(/[\s,]+/).filter(Boolean);
  // Legacy comma syntax carries alpha as the 4th argument.
  if (alphaPart === undefined && args.length === 4) {
    return { args: args.slice(0, 3), alphaToken: args[3] };
  }
  return { args, alphaToken: alphaPart };
};

export function parseColor(input: string): ParsedColor | null {
  const text = input.trim();
  if (text.startsWith("#")) return parseHex(text);

  const match = /^(rgba?|hsla?|oklch)\(\s*(.+?)\s*\)$/i.exec(text);
  if (!match) return null;
  const fn = match[1].toLowerCase();
  const { args, alphaToken } = splitArgs(match[2]);
  if (args.length !== 3) return null;
  const alpha = parseAlphaToken(alphaToken);
  if (alpha === null) return null;

  if (fn === "rgb" || fn === "rgba") {
    const r = parseComponent(args[0], 255);
    const g = parseComponent(args[1], 255);
    const b = parseComponent(args[2], 255);
    if (r === null || g === null || b === null) return null;
    return { rgb: clampRgb({ r, g, b }), alpha };
  }

  if (fn === "hsl" || fn === "hsla") {
    const h = parseComponent(args[0].replace(/deg$/i, ""), 360);
    const s = parseComponent(args[1], 100);
    const l = parseComponent(args[2], 100);
    if (h === null || s === null || l === null) return null;
    return { rgb: clampRgb(hslToRgb({ h, s, l })), alpha };
  }

  // oklch(L C H) — L accepts 0-1 or a percentage.
  const l = parseComponent(args[0], 1);
  const c = parseComponent(args[1], 0.4);
  const h = parseComponent(args[2].replace(/deg$/i, ""), 360);
  if (l === null || c === null || h === null) return null;
  return { rgb: clampRgb(oklchToRgb({ l, c, h })), alpha };
}

/* ------------------------------ formatting ------------------------------ */

const toHexPair = (channel: number): string =>
  Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

export function formatHex(rgb: RgbColor, alpha = 1): string {
  const base = `#${toHexPair(rgb.r)}${toHexPair(rgb.g)}${toHexPair(rgb.b)}`;
  return alpha < 1 ? `${base}${toHexPair(alpha * 255)}` : base;
}

const alphaSuffix = (alpha: number): string => (alpha < 1 ? ` / ${round(alpha, 3)}` : "");

export function formatRgb(rgb: RgbColor, alpha = 1): string {
  const c = clampRgb(rgb);
  return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}${alphaSuffix(alpha)})`;
}

export function formatHsl(rgb: RgbColor, alpha = 1): string {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%${alphaSuffix(alpha)})`;
}

export function formatOklch(rgb: RgbColor, alpha = 1): string {
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 1)}${alphaSuffix(alpha)})`;
}
