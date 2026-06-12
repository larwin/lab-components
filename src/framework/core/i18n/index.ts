/**
 * i18n — locale services consumed by the core and the components.
 *
 * Every user-visible string inside Forge machines flows through a translator,
 * sorting/typeahead use Intl.Collator, and direction is a first-class concept
 * (navigation semantics flip in RTL at the adapter level).
 */

export type MessageValues = Record<string, string | number>;
export type Message = string | ((values: MessageValues) => string);
export type MessageBundle = Record<string, Message>;

export interface Translator {
  readonly locale: string;
  readonly direction: "ltr" | "rtl";
  t(key: string, values?: MessageValues): string;
}

const RTL_LANGS = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi"]);

export function getTextDirection(locale: string): "ltr" | "rtl" {
  const lang = locale.split("-")[0].toLowerCase();
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

const interpolate = (template: string, values?: MessageValues): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`));

export function createTranslator(
  locale: string,
  bundles: Record<string, MessageBundle>,
  fallbackLocale = "en",
): Translator {
  const lang = locale.split("-")[0];
  const chain = [bundles[locale], bundles[lang], bundles[fallbackLocale]].filter(Boolean);
  return {
    locale,
    direction: getTextDirection(locale),
    t(key, values) {
      for (const bundle of chain) {
        const message = bundle[key];
        if (message === undefined) continue;
        return typeof message === "function" ? message(values ?? {}) : interpolate(message, values);
      }
      return key;
    },
  };
}

export function createSortCollator(locale = "en"): Intl.Collator {
  return new Intl.Collator(locale, { usage: "sort", numeric: true, sensitivity: "variant" });
}

export { createSearchCollator } from "../collection/typeahead";
