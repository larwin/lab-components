import type { RgbColor } from "./convert";

/**
 * WCAG 2.x contrast — relative luminance over linearized sRGB and the
 * (L1 + 0.05) / (L2 + 0.05) ratio, with the standard conformance thresholds.
 */

const linearize = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio, 1 to 21, order-independent. */
export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [dark, light] = la < lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export interface WcagVerdict {
  ratio: number;
  /** AA, normal text: ≥ 4.5. */
  aaNormal: boolean;
  /** AA, large text (≥ 18.66px bold / 24px): ≥ 3. */
  aaLarge: boolean;
  /** AAA, normal text: ≥ 7. */
  aaaNormal: boolean;
  /** AAA, large text: ≥ 4.5. */
  aaaLarge: boolean;
}

export function wcagContrast(a: RgbColor, b: RgbColor): WcagVerdict {
  const ratio = contrastRatio(a, b);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}
