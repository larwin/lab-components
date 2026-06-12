import { createMachine, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { emitEvent, focusElement, type Effect } from "../runtime/effect";
import type { AriaProps, KeyBinding } from "../behaviors/behavior";

/**
 * Segment field — THE generic segmented-input machine (the PIN pattern, grown
 * up). A field is an ordered list of segment specs (day/month/year for dates,
 * hour/minute/second/dayPeriod for times); the machine owns the segment
 * cursor, digit typing with auto-advance, spinbutton arrows (wrap or clamp),
 * Backspace clear-then-step-back, and the draft rule: a segment mid-entry
 * counts as empty for events, and `change` fires only at commit points. The
 * composed value is a pure projection injected by config (`getValue` +
 * `isEqual`), so clamping collisions (31/02 → 28/02) never double-fire.
 *
 * dateField and timeField are configurations of this machine — new segmented
 * inputs should be too.
 */

export type SegmentValues = Readonly<Record<string, number | null>>;

export interface SegmentSpec {
  /** Identity of the segment within `values`. */
  readonly key: string;
  /** Inclusive numeric bounds — also the spinbutton ARIA range. */
  readonly min: number;
  readonly max: number;
  /**
   * Dynamic wrap bound for arrow steps when it depends on sibling segments
   * (day wraps on the real month length). Defaults to `max`.
   */
  readonly wrapMax?: (values: SegmentValues) => number;
  /** Arrows wrap around the bounds (day/month/hour) or clamp (year). */
  readonly wrap: boolean;
  /** Digit capacity — typing this many digits auto-advances. */
  readonly digits: number;
  /**
   * Non-digit input parser for textual segments (dayPeriod: localized
   * "a"/"p"). A match sets the value outright and auto-advances.
   */
  readonly parseChar?: (char: string) => number | null;
}

export interface SegmentFieldState {
  readonly values: SegmentValues;
  /** Active segment index within config.segments. */
  readonly cursor: number;
  /** Digits typed into the active segment since it was entered. */
  readonly typed: string;
}

export interface SegmentFieldConfig<V> {
  /** Machine id ("datefield", "timefield"). */
  readonly id: string;
  /** Editable segments in locale order (from Intl.formatToParts). */
  readonly segments: readonly SegmentSpec[];
  /** Pure projection: composed value, or null while incomplete/invalid. */
  readonly getValue: (values: SegmentValues) => V | null;
  /** Equality on composed values — change detection at commit points. */
  readonly isEqual: (a: V, b: V) => boolean;
  /** Seeds ArrowUp/Down on an empty segment — "now" injected by the adapter. */
  readonly getPlaceholder?: () => Readonly<Record<string, number>>;
  /** RTL flips ArrowLeft/ArrowRight. */
  readonly direction?: () => "ltr" | "rtl";
}

export const segmentFieldIntents = {
  /** Type one printable char into the active segment (digits normalized, textual segments via parseChar). */
  input: defineIntent<{ char: string }>("segments/input"),
  /** Spinbutton step on the active segment (wrap or clamp per spec). */
  increment: defineIntent<{ delta: 1 | -1 }>("segments/increment"),
  /** Move the segment cursor (arrows). */
  move: defineIntent<{ direction: 1 | -1 }>("segments/move"),
  /** Set the cursor directly (pointer click, Home/End). */
  focusSegment: defineIntent<{ index: number }>("segments/focus-segment"),
  /** Clear the active segment, or step back and clear when already empty. */
  backspace: defineIntent<void>("segments/backspace"),
  /** Clear the active segment without moving (Delete). */
  deleteForward: defineIntent<void>("segments/delete"),
  /** Commit a partial entry (adapter dispatches it when focus leaves the field). */
  commit: defineIntent<void>("segments/commit"),
  /** Reset every segment. */
  clear: defineIntent<void>("segments/clear"),
  /** Controlled-value sync — silent (no focus, no change echo). */
  setValues: defineIntent<{ values: SegmentValues }>("segments/set-values"),
};

/** Normalize ASCII, Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits. */
export function normalizeDigit(char: string): string | null {
  if (char.length !== 1) return null;
  if (/[0-9]/.test(char)) return char;
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  return null;
}

/** Spinbutton ARIA for one segment — derived; the shell adds the localized label. */
export function segmentAria(
  spec: SegmentSpec,
  value: number | null,
  valueText?: string,
): AriaProps {
  return {
    role: "spinbutton",
    "aria-valuemin": spec.min,
    "aria-valuemax": spec.max,
    "aria-valuenow": value ?? undefined,
    "aria-valuetext": value === null ? undefined : valueText,
  };
}

export function createSegmentFieldMachine<V>(
  config: SegmentFieldConfig<V>,
): Machine<SegmentFieldState> {
  const segments = config.segments;
  const clampIndex = (index: number) => Math.min(segments.length - 1, Math.max(0, index));
  const specAt = (index: number): SegmentSpec => segments[clampIndex(index)];

  const write = (
    state: SegmentFieldState,
    key: string,
    value: number | null,
  ): SegmentFieldState => ({ ...state, values: { ...state.values, [key]: value } });

  const emptyValues = (): SegmentValues => Object.fromEntries(segments.map((s) => [s.key, null]));

  /**
   * A segment mid-entry is a draft: it counts as empty for event purposes, and
   * `change` only fires at commit points (typed buffer back to "") — so typing
   * "2026" emits once with the full year, never 2 → 20 → 202.
   */
  const committedValue = (state: SegmentFieldState): V | null =>
    state.typed === ""
      ? config.getValue(state.values)
      : config.getValue({ ...state.values, [specAt(state.cursor).key]: null });

  /** change event (at commit points) + focus effect on cursor moves. */
  const valueEffects = (
    prev: SegmentFieldState,
    next: SegmentFieldState,
    source: string,
  ): Effect[] => {
    const effects: Effect[] = [];
    if (source !== "program") {
      if (next.typed === "") {
        const before = committedValue(prev);
        const after = config.getValue(next.values);
        const changed =
          before === null || after === null ? before !== after : !config.isEqual(before, after);
        if (changed) effects.push(emitEvent({ name: "change", detail: { value: after } }));
      }
      if (next.cursor !== prev.cursor && source !== "pointer") {
        effects.push(focusElement({ target: String(next.cursor) }));
      }
    }
    return effects;
  };

  return createMachine<SegmentFieldState>({
    id: config.id,
    initialState: { values: emptyValues(), cursor: 0, typed: "" },
    handlers: {
      [segmentFieldIntents.input.type]: (state, intent) => {
        const { char } = intent.payload as { char: string };
        const spec = specAt(state.cursor);
        const digit = normalizeDigit(char);

        if (digit === null) {
          // Textual segment (dayPeriod): a parseChar match sets and advances.
          const parsed = spec.parseChar?.(char) ?? null;
          if (parsed === null) return state;
          const next: SegmentFieldState = {
            ...write(state, spec.key, parsed),
            cursor: clampIndex(state.cursor + 1),
            typed: "",
          };
          return withEffects(next, ...valueEffects(state, next, intent.source));
        }

        let typed = state.typed + digit;
        let numeric = Number(typed);
        // Overflow restarts the segment with the new digit ("1" then "3" in a
        // month is 3, not 13) — matches native date inputs.
        if (numeric > spec.max || typed.length > spec.digits) {
          typed = digit;
          numeric = Number(digit);
        }
        // Auto-advance when one more digit could not fit the segment any more.
        const full = typed.length === spec.digits || numeric * 10 > spec.max;
        const cursor = full ? clampIndex(state.cursor + 1) : state.cursor;
        const next: SegmentFieldState = {
          ...write(state, spec.key, numeric),
          cursor,
          typed: full ? "" : typed,
        };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.increment.type]: (state, intent) => {
        const { delta } = intent.payload as { delta: 1 | -1 };
        const spec = specAt(state.cursor);
        const current = state.values[spec.key];
        let value: number;
        if (current === null) {
          const seed = config.getPlaceholder?.()[spec.key];
          value = seed ?? (spec.wrap ? spec.min : spec.max);
        } else if (!spec.wrap) {
          value = Math.min(spec.max, Math.max(spec.min, current + delta));
        } else {
          // Wrap within the real bounds (day wraps on the known month length).
          const max = spec.wrapMax?.(state.values) ?? spec.max;
          const range = max - spec.min + 1;
          value = ((((current - spec.min + delta) % range) + range) % range) + spec.min;
        }
        if (value === current) return state;
        const next: SegmentFieldState = { ...write(state, spec.key, value), typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.move.type]: (state, intent) => {
        const { direction } = intent.payload as { direction: 1 | -1 };
        const cursor = clampIndex(state.cursor + direction);
        if (cursor === state.cursor) return state;
        const next: SegmentFieldState = { ...state, cursor, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.focusSegment.type]: (state, intent) => {
        const index = clampIndex((intent.payload as { index: number }).index);
        if (index === state.cursor) {
          return state.typed === "" ? state : { ...state, typed: "" };
        }
        const next: SegmentFieldState = { ...state, cursor: index, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.backspace.type]: (state, intent) => {
        const spec = specAt(state.cursor);
        if (state.values[spec.key] !== null) {
          const next: SegmentFieldState = { ...write(state, spec.key, null), typed: "" };
          return withEffects(next, ...valueEffects(state, next, intent.source));
        }
        if (state.cursor === 0) return state;
        const cursor = state.cursor - 1;
        const next: SegmentFieldState = {
          ...write(state, specAt(cursor).key, null),
          cursor,
          typed: "",
        };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.deleteForward.type]: (state, intent) => {
        const spec = specAt(state.cursor);
        if (state.values[spec.key] === null) return state;
        const next: SegmentFieldState = { ...write(state, spec.key, null), typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.commit.type]: (state, intent) => {
        if (state.typed === "") return state;
        const next: SegmentFieldState = { ...state, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.clear.type]: (state, intent) => {
        const empty = emptyValues();
        if (segments.every((s) => state.values[s.key] === null)) return state;
        const next: SegmentFieldState = { values: empty, cursor: 0, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [segmentFieldIntents.setValues.type]: (state, intent) => {
        const { values } = intent.payload as { values: SegmentValues };
        const merged: SegmentValues = Object.fromEntries(
          segments.map((s) => [s.key, values[s.key] ?? null]),
        );
        const same = segments.every((s) => merged[s.key] === state.values[s.key]);
        return same ? state : { ...state, values: merged, typed: "" };
      },
    },
  });
}

/** Declarative keymap for the segments (resolved by the adapter). */
export function segmentFieldKeymap<V>(config: SegmentFieldConfig<V>): KeyBinding[] {
  const horizontal = (sign: 1 | -1): 1 | -1 =>
    (config.direction?.() ?? "ltr") === "rtl" ? (-sign as 1 | -1) : sign;
  const textual = config.segments.some((s) => s.parseChar);
  return [
    {
      keys: "@printable",
      intent: (stroke) =>
        // Digits always; other printables only when a textual segment could
        // consume them — unmatched chars must not preventDefault globally.
        normalizeDigit(stroke.key) !== null || (textual && stroke.key.length === 1)
          ? segmentFieldIntents.input({ char: stroke.key }, "keyboard")
          : null,
    },
    { keys: "ArrowUp", intent: () => segmentFieldIntents.increment({ delta: 1 }, "keyboard") },
    { keys: "ArrowDown", intent: () => segmentFieldIntents.increment({ delta: -1 }, "keyboard") },
    {
      keys: "ArrowLeft",
      intent: () => segmentFieldIntents.move({ direction: horizontal(-1) }, "keyboard"),
    },
    {
      keys: "ArrowRight",
      intent: () => segmentFieldIntents.move({ direction: horizontal(1) }, "keyboard"),
    },
    { keys: "Backspace", intent: () => segmentFieldIntents.backspace(undefined, "keyboard") },
    { keys: "Delete", intent: () => segmentFieldIntents.deleteForward(undefined, "keyboard") },
    { keys: "Home", intent: () => segmentFieldIntents.focusSegment({ index: 0 }, "keyboard") },
    {
      keys: "End",
      intent: () =>
        segmentFieldIntents.focusSegment({ index: config.segments.length - 1 }, "keyboard"),
    },
  ];
}
