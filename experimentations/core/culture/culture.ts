import type { I18nText } from './i18n';
import { resolveI18nText } from './i18n';

export type CultureTranslate = (key: string, params?: Record<string, unknown>) => string;

export interface CultureFormatters {
  number: (n: number, options?: Intl.NumberFormatOptions) => string;
  date: (d: Date, options?: Intl.DateTimeFormatOptions) => string;
  percent?: (n: number) => string;
}

/**
 * Culture - the localization contract that the UI provides to list-based components.
 */
export interface Culture {
  /** BCP 47 culture code, e.g. 'fr-FR', 'en-US' */
  code: string;

  /** Translate a key for the active culture */
  translate: CultureTranslate;

  /** Type-aware formatters for the active culture */
  format: CultureFormatters;
}

export interface CreateCultureOptions {
  code: string;
  messages?: Record<string, string>;
  translate?: CultureTranslate;
  format?: Partial<CultureFormatters>;
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function serializeOptions(options?: Record<string, unknown>): string {
  if (!options) return '';
  return JSON.stringify(
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function getNumberFormatter(code: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${code}::${serializeOptions(options as Record<string, unknown> | undefined)}`;
  const cached = numberFormatCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(code, options);
  numberFormatCache.set(key, formatter);
  return formatter;
}

function getDateFormatter(code: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${code}::${serializeOptions(options as Record<string, unknown> | undefined)}`;
  const cached = dateFormatCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(code, options);
  dateFormatCache.set(key, formatter);
  return formatter;
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ''));
}

function createDefaultTranslate(messages?: Record<string, string>): CultureTranslate {
  return (key, params) => interpolate(messages?.[key] ?? key, params);
}

function createDefaultFormatters(code: string): CultureFormatters {
  return {
    number: (n, options) => getNumberFormatter(code, options).format(n),
    date: (d, options) => getDateFormatter(code, options).format(d),
    percent: (n) => getNumberFormatter(code, { style: 'percent' }).format(n),
  };
}

/**
 * createCulture - build a Culture from the small public API.
 */
export function createCulture({
  code,
  messages,
  translate,
  format,
}: CreateCultureOptions): Culture {
  return {
    code,
    translate: translate ?? createDefaultTranslate(messages),
    format: {
      ...createDefaultFormatters(code),
      ...format,
    },
  };
}

/**
 * createTestCulture - a minimal Culture for unit tests.
 */
export function createTestCulture(code = 'en-US'): Culture {
  return createCulture({
    code,
  });
}

/**
 * resolveText - convenience: resolve I18n-like text using a Culture.
 */
export function resolveText(text: I18nText, culture: Culture): string {
  return resolveI18nText(text, culture.translate);
}
