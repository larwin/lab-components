/**
 * I18nText - how the core represents any user-visible text.
 *
 * 'literal': the string is already in the correct language.
 * 'key': a translation key to be resolved by the UI via Culture.translate().
 */
export type I18nText =
  | { kind: 'literal'; value: string }
  | { kind: 'key'; key: string; params?: Record<string, unknown>; fallback?: string };

/**
 * resolveI18nText - resolves an I18nText to a plain string.
 */
export function resolveI18nText(
  text: I18nText,
  t?: (key: string, params?: Record<string, unknown>) => string
): string {
  if (text.kind === 'literal') return text.value;

  if (t) {
    const result = t(text.key, text.params);
    if (result !== text.key) return result;
  }

  return text.fallback ?? text.key;
}

/**
 * i18n - convenience helpers to create I18nText values.
 */
export const i18n = {
  literal: (value: string): I18nText => ({ kind: 'literal', value }),
  key: (key: string, params?: Record<string, unknown>, fallback?: string): I18nText => ({
    kind: 'key',
    key,
    params,
    fallback,
  }),
};
