import type { KeyBinding } from "../behaviors/behavior";
import type { Intent } from "../runtime/intent";
import {
  isPrintableStroke,
  matchesCombo,
  parseKeyCombo,
  type KeyCombo,
  type KeyStroke,
  type Platform,
} from "./keys";

/**
 * Keymap resolution — pure matching of a stroke against declarative bindings.
 * First matching binding wins (composition order is priority); a binding whose
 * intent factory returns null falls through to the next. The sentinel combo
 * "@printable" matches any printable character (typeahead).
 */

const comboCache = new Map<string, KeyCombo>();
const comboFor = (keys: string): KeyCombo => {
  let combo = comboCache.get(keys);
  if (!combo) {
    combo = parseKeyCombo(keys);
    comboCache.set(keys, combo);
  }
  return combo;
};

export function resolveBinding(
  bindings: readonly KeyBinding[],
  stroke: KeyStroke,
  platform: Platform = "other",
): { binding: KeyBinding; intent: Intent } | null {
  for (const binding of bindings) {
    const matches =
      binding.keys === "@printable"
        ? isPrintableStroke(stroke)
        : matchesCombo(stroke, comboFor(binding.keys), platform);
    if (!matches) continue;
    const intent = binding.intent(stroke);
    if (intent) return { binding, intent };
  }
  return null;
}
