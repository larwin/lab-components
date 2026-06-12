/**
 * Key combos — a structural, DOM-free model of keyboard input.
 *
 * `KeyStroke` mirrors the fields we need from KeyboardEvent without depending
 * on it, so the entire keyboard layer is testable in plain Node. Combos use a
 * human syntax: "ArrowDown", "Mod+K", "Ctrl+Shift+Home", "Alt+Enter".
 * "Mod" resolves to Meta on macOS and Ctrl elsewhere.
 */

export interface KeyStroke {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** Event timestamp (ms, monotonic within a session) — feeds typeahead expiry. */
  readonly at?: number;
}

export type Platform = "mac" | "windows" | "linux" | "other";

export interface KeyCombo {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** True when the combo used "Mod" (platform-resolved at match time). */
  readonly mod: boolean;
}

const MODIFIERS = new Set([
  "ctrl",
  "control",
  "meta",
  "cmd",
  "command",
  "alt",
  "option",
  "shift",
  "mod",
]);

/** Parse "Mod+Shift+K" into a structured combo. Case-insensitive modifiers.
 *  The space bar is written "Space" ("Shift+Space"). */
export function parseKeyCombo(combo: string): KeyCombo {
  const parts = combo.split("+").map((p) => p.trim());
  let key = "";
  let ctrl = false,
    meta = false,
    alt = false,
    shift = false,
    mod = false;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MODIFIERS.has(lower)) {
      if (lower === "ctrl" || lower === "control") ctrl = true;
      else if (lower === "meta" || lower === "cmd" || lower === "command") meta = true;
      else if (lower === "alt" || lower === "option") alt = true;
      else if (lower === "shift") shift = true;
      else mod = true;
    } else if (lower === "space") {
      key = " ";
    } else if (part.length > 0) {
      key = part.length === 1 ? part.toLowerCase() : part;
    }
  }
  return { key, ctrl, meta, alt, shift, mod };
}

export function matchesCombo(
  stroke: KeyStroke,
  combo: KeyCombo,
  platform: Platform = "other",
): boolean {
  const wantMeta = combo.meta || (combo.mod && platform === "mac");
  const wantCtrl = combo.ctrl || (combo.mod && platform !== "mac");
  const strokeKey = stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
  return (
    strokeKey === combo.key &&
    stroke.ctrl === wantCtrl &&
    stroke.meta === wantMeta &&
    stroke.alt === combo.alt &&
    stroke.shift === combo.shift
  );
}

/** Render a combo for UI display ("⌘⇧K" on mac, "Ctrl+Shift+K" elsewhere). */
export function formatKeyCombo(combo: string | KeyCombo, platform: Platform = "other"): string {
  const c = typeof combo === "string" ? parseKeyCombo(combo) : combo;
  const key = c.key.length === 1 ? c.key.toUpperCase() : c.key;
  if (platform === "mac") {
    return [
      c.ctrl ? "⌃" : "",
      c.alt ? "⌥" : "",
      c.shift ? "⇧" : "",
      c.meta || c.mod ? "⌘" : "",
      key,
    ].join("");
  }
  const parts: string[] = [];
  if (c.ctrl || c.mod) parts.push("Ctrl");
  if (c.alt) parts.push("Alt");
  if (c.shift) parts.push("Shift");
  if (c.meta) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

/** True when the stroke is plain printable text (typeahead candidate). */
export function isPrintableStroke(stroke: KeyStroke): boolean {
  return stroke.key.length === 1 && !stroke.ctrl && !stroke.meta && !stroke.alt;
}

/**
 * Swap ArrowLeft/ArrowRight in RTL so "next" stays the *visual* forward
 * direction. Horizontal adapters (toolbar, carousel) flip the stroke before
 * resolving it against a keymap — the keymap itself never knows about
 * direction (RTL is an adapter concern, the mapping is pure).
 */
export function flipHorizontalStroke(stroke: KeyStroke, direction: "ltr" | "rtl"): KeyStroke {
  if (direction !== "rtl") return stroke;
  if (stroke.key === "ArrowLeft") return { ...stroke, key: "ArrowRight" };
  if (stroke.key === "ArrowRight") return { ...stroke, key: "ArrowLeft" };
  return stroke;
}
