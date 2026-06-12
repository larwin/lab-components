/**
 * Locale-aware number formatting/parsing on Intl.NumberFormat — pure, no DOM.
 *
 * Formatting is Intl directly; parsing reverse-engineers the locale's
 * separators from `formatToParts` so "1 234,56" (fr) and "1,234.56" (en)
 * round-trip through the same NumberField.
 */

export interface NumberFormatSpec {
  locale?: string;
  options?: Intl.NumberFormatOptions;
}

const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
};

export function formatNumber(
  value: number,
  locale = "en",
  options?: Intl.NumberFormatOptions,
): string {
  return formatterFor(locale, options).format(value);
}

interface LocaleSeparators {
  group: string;
  decimal: string;
  minus: string;
}

const separatorCache = new Map<string, LocaleSeparators>();

const separatorsFor = (locale: string): LocaleSeparators => {
  let seps = separatorCache.get(locale);
  if (!seps) {
    const parts = new Intl.NumberFormat(locale).formatToParts(-12345.6);
    seps = {
      group: parts.find((p) => p.type === "group")?.value ?? ",",
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
      minus: parts.find((p) => p.type === "minusSign")?.value ?? "-",
    };
    separatorCache.set(locale, seps);
  }
  return seps;
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Parses user input in the given locale. Returns `null` when the text holds no
 * number. Currency/percent symbols and all space variants are tolerated; a
 * percent style divides by 100 so state always stores the raw ratio.
 */
export function parseNumber(
  text: string,
  locale = "en",
  options?: Intl.NumberFormatOptions,
): number | null {
  const { group, decimal, minus } = separatorsFor(locale);
  const normalized = text
    .trim()
    // All Unicode spaces (incl. U+00A0 and U+202F used as French group separators).
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[%€$£¥]/g, "")
    .replace(new RegExp(escapeRegExp(minus), "g"), "-")
    .replace(/−/g, "-")
    .replace(new RegExp(escapeRegExp(group), "g"), "")
    .replace(decimal !== "." ? new RegExp(escapeRegExp(decimal), "g") : /\./g, ".");
  if (normalized === "" || normalized === "-") return null;
  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return options?.style === "percent" ? value / 100 : value;
}
