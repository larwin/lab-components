import type { Collection, Key } from "./collection";

/**
 * Typeahead — culture-aware "type to focus" used by lists, trees, menus and
 * combo boxes. Matching uses Intl.Collator with `usage: "search"` and base
 * sensitivity so "e" matches "É" in French, "i" matches "İ" correctly per
 * locale, etc. Pure: time is injected by the caller (the adapter passes
 * event timestamps), so buffer expiry is fully testable.
 */

export interface TypeaheadState {
  readonly buffer: string;
  readonly lastTypedAt: number;
}

export const EMPTY_TYPEAHEAD: TypeaheadState = { buffer: "", lastTypedAt: 0 };

export const TYPEAHEAD_TIMEOUT_MS = 700;

export function createSearchCollator(locale = "en"): Intl.Collator {
  return new Intl.Collator(locale, { usage: "search", sensitivity: "base" });
}

const startsWith = (collator: Intl.Collator, text: string, query: string): boolean => {
  if (query.length === 0) return false;
  if (text.length < query.length) return false;
  return collator.compare(text.slice(0, query.length), query) === 0;
};

export interface TypeaheadResult {
  readonly state: TypeaheadState;
  readonly matchKey: Key | null;
}

/**
 * Feed one printable character. Search starts *after* the focused key and
 * wraps, so repeatedly typing "a" cycles through entries starting with "a"
 * (single-char repeat behaves like a cycle, multi-char like a prefix search).
 */
export function typeaheadStep<T>(
  state: TypeaheadState,
  options: {
    collection: Collection<T>;
    visible: readonly Key[];
    focusedKey: Key | null;
    char: string;
    now: number;
    collator: Intl.Collator;
    timeoutMs?: number;
  },
): TypeaheadResult {
  const { collection, visible, focusedKey, char, now, collator } = options;
  const timeout = options.timeoutMs ?? TYPEAHEAD_TIMEOUT_MS;
  const expired = now - state.lastTypedAt > timeout;
  const previous = expired ? "" : state.buffer;

  const isRepeat = previous.length > 0 && previous.split("").every((c) => c === char);
  const query = isRepeat ? char : previous + char;
  const nextState: TypeaheadState = {
    buffer: isRepeat ? previous + char : query,
    lastTypedAt: now,
  };

  if (visible.length === 0) return { state: nextState, matchKey: null };

  const startIndex = focusedKey !== null ? visible.indexOf(focusedKey) : -1;
  // On a fresh (non-repeat, single-char) search, include the focused item so a
  // prefix being typed keeps matching it; on repeats, start after it to cycle.
  const offset = isRepeat || query.length === 1 ? 1 : 0;

  for (let i = 0; i < visible.length; i++) {
    const index = (startIndex + offset + i + visible.length) % visible.length;
    const node = collection.getNode(visible[index]);
    if (!node || node.kind !== "item" || node.disabled) continue;
    if (startsWith(collator, node.textValue, query)) {
      return { state: nextState, matchKey: node.key };
    }
  }
  return { state: nextState, matchKey: null };
}
