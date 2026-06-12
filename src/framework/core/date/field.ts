import { createMachine, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { emitEvent, focusElement, type Effect } from "../runtime/effect";
import type { AriaProps, KeyBinding } from "../behaviors/behavior";
import type { DateSegmentType } from "./intl";
import { daysInMonth, isSameDay, type DateValue } from "./value";

/**
 * Date field — segmented day/month/year input, one spinbutton per segment in
 * locale order (the adapter derives the order from Intl.formatToParts and
 * injects it as config). The PIN pattern, grown up: a segment cursor whose
 * moves come back as `dom/focus-element` effects keyed by segment index,
 * digit typing with auto-advance (day "4" can only be 04 → advance; month "2"
 * → advance; 2/2/4 digit caps), arrows as spinbuttons (wrap on day/month),
 * Backspace clears then steps back. The composed value emits a single
 * `change` event whenever it transitions (complete dates clamp the day to the
 * month length); program-sourced sync stays fully silent.
 */

export interface DateFieldState {
  readonly day: number | null;
  readonly month: number | null;
  readonly year: number | null;
  /** Active segment index within config.segments. */
  readonly cursor: number;
  /** Digits typed into the active segment since it was entered. */
  readonly typed: string;
}

export interface DateFieldConfig {
  /** Editable segments in locale order (from `dateFieldParts`). */
  segments: readonly DateSegmentType[];
  /** Seeds ArrowUp/Down on an empty segment — "today" injected by the adapter. */
  getPlaceholderDate?: () => DateValue;
  /** RTL flips ArrowLeft/ArrowRight. */
  direction?: () => "ltr" | "rtl";
}

export const dateFieldIntents = {
  /** Type one digit into the active segment (Arabic-Indic digits normalized). */
  input: defineIntent<{ digit: string }>("datefield/input"),
  /** Spinbutton step on the active segment (wraps day/month, clamps year). */
  increment: defineIntent<{ delta: 1 | -1 }>("datefield/increment"),
  /** Move the segment cursor (arrows). */
  move: defineIntent<{ direction: 1 | -1 }>("datefield/move"),
  /** Set the cursor directly (pointer click, Home/End). */
  focusSegment: defineIntent<{ index: number }>("datefield/focus-segment"),
  /** Clear the active segment, or step back and clear when already empty. */
  backspace: defineIntent<void>("datefield/backspace"),
  /** Clear the active segment without moving (Delete). */
  deleteForward: defineIntent<void>("datefield/delete"),
  /** Commit a partial entry (adapter dispatches it when focus leaves the field). */
  commit: defineIntent<void>("datefield/commit"),
  /** Reset every segment. */
  clear: defineIntent<void>("datefield/clear"),
  /** Controlled-value sync — silent (no focus, no change echo). */
  setValue: defineIntent<{ date: DateValue | null }>("datefield/set-value"),
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

const SEGMENT_MAX: Record<DateSegmentType, number> = { day: 31, month: 12, year: 9999 };
const SEGMENT_DIGITS: Record<DateSegmentType, number> = { day: 2, month: 2, year: 4 };

/**
 * The composed value: null until every segment is filled and valid; the day is
 * clamped to the real month length (31/02 → 28/02), NumericValue philosophy.
 */
export function dateFieldValue(state: DateFieldState): DateValue | null {
  const { day, month, year } = state;
  if (day === null || month === null || year === null) return null;
  if (day < 1 || month < 1 || month > 12 || year < 1) return null;
  return { year, month, day: Math.min(day, daysInMonth(year, month)) };
}

/** Spinbutton ARIA for one segment — derived, the shell adds the localized label. */
export function dateSegmentAria(type: DateSegmentType, value: number | null): AriaProps {
  return {
    role: "spinbutton",
    "aria-valuemin": 1,
    "aria-valuemax": SEGMENT_MAX[type],
    "aria-valuenow": value ?? undefined,
  };
}

export function createDateFieldMachine(config: DateFieldConfig): Machine<DateFieldState> {
  const segments = config.segments;
  const clampIndex = (index: number) => Math.min(segments.length - 1, Math.max(0, index));
  const segmentAt = (index: number): DateSegmentType => segments[clampIndex(index)];

  const read = (state: DateFieldState, type: DateSegmentType): number | null => state[type];
  const write = (state: DateFieldState, type: DateSegmentType, value: number | null) =>
    ({ ...state, [type]: value }) as DateFieldState;

  /**
   * A segment mid-entry is a draft: it counts as empty for event purposes, and
   * `change` only fires at commit points (typed buffer back to "") — so typing
   * "2026" emits once with the full year, never 2 → 20 → 202.
   */
  const committedValue = (state: DateFieldState): DateValue | null =>
    state.typed === ""
      ? dateFieldValue(state)
      : dateFieldValue(write(state, segmentAt(state.cursor), null));

  /** change event (at commit points) + focus effect on cursor moves. */
  const valueEffects = (prev: DateFieldState, next: DateFieldState, source: string): Effect[] => {
    const effects: Effect[] = [];
    if (source !== "program") {
      if (next.typed === "") {
        const before = committedValue(prev);
        const after = dateFieldValue(next);
        const changed =
          before === null || after === null ? before !== after : !isSameDay(before, after);
        if (changed) effects.push(emitEvent({ name: "change", detail: { date: after } }));
      }
      if (next.cursor !== prev.cursor && source !== "pointer") {
        effects.push(focusElement({ target: String(next.cursor) }));
      }
    }
    return effects;
  };

  return createMachine<DateFieldState>({
    id: "datefield",
    initialState: { day: null, month: null, year: null, cursor: 0, typed: "" },
    handlers: {
      [dateFieldIntents.input.type]: (state, intent) => {
        const digit = normalizeDigit((intent.payload as { digit: string }).digit);
        if (digit === null) return state;
        const type = segmentAt(state.cursor);
        let typed = state.typed + digit;
        let numeric = Number(typed);
        // Overflow restarts the segment with the new digit ("1" then "3" in a
        // month is 3, not 13) — matches native date inputs.
        if (numeric > SEGMENT_MAX[type] || typed.length > SEGMENT_DIGITS[type]) {
          typed = digit;
          numeric = Number(digit);
        }
        // Auto-advance when one more digit could not fit the segment any more.
        const full = typed.length === SEGMENT_DIGITS[type] || numeric * 10 > SEGMENT_MAX[type];
        const cursor = full ? clampIndex(state.cursor + 1) : state.cursor;
        const next: DateFieldState = {
          ...write(state, type, numeric),
          cursor,
          typed: full ? "" : typed,
        };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.increment.type]: (state, intent) => {
        const { delta } = intent.payload as { delta: 1 | -1 };
        const type = segmentAt(state.cursor);
        const current = read(state, type);
        let value: number;
        if (current === null) {
          const seed = config.getPlaceholderDate?.();
          value = seed ? seed[type] : type === "year" ? SEGMENT_MAX.year : 1;
        } else if (type === "year") {
          value = Math.min(SEGMENT_MAX.year, Math.max(1, current + delta));
        } else {
          // Wrap within the real bounds; day wraps on the known month length.
          const max =
            type === "day" ? daysInMonth(state.year ?? 2024, state.month ?? 1) : SEGMENT_MAX.month;
          value = ((current - 1 + delta + max) % max) + 1;
        }
        if (value === current) return state;
        const next: DateFieldState = { ...write(state, type, value), typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.move.type]: (state, intent) => {
        const { direction } = intent.payload as { direction: 1 | -1 };
        const cursor = clampIndex(state.cursor + direction);
        if (cursor === state.cursor) return state;
        const next: DateFieldState = { ...state, cursor, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.focusSegment.type]: (state, intent) => {
        const index = clampIndex((intent.payload as { index: number }).index);
        if (index === state.cursor) {
          return state.typed === "" ? state : { ...state, typed: "" };
        }
        const next: DateFieldState = { ...state, cursor: index, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.backspace.type]: (state, intent) => {
        const type = segmentAt(state.cursor);
        if (read(state, type) !== null) {
          const next: DateFieldState = { ...write(state, type, null), typed: "" };
          return withEffects(next, ...valueEffects(state, next, intent.source));
        }
        if (state.cursor === 0) return state;
        const cursor = state.cursor - 1;
        const next: DateFieldState = {
          ...write(state, segmentAt(cursor), null),
          cursor,
          typed: "",
        };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.deleteForward.type]: (state, intent) => {
        const type = segmentAt(state.cursor);
        if (read(state, type) === null) return state;
        const next: DateFieldState = { ...write(state, type, null), typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.commit.type]: (state, intent) => {
        if (state.typed === "") return state;
        const next: DateFieldState = { ...state, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.clear.type]: (state, intent) => {
        if (state.day === null && state.month === null && state.year === null) return state;
        const next: DateFieldState = { day: null, month: null, year: null, cursor: 0, typed: "" };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [dateFieldIntents.setValue.type]: (state, intent) => {
        const { date } = intent.payload as { date: DateValue | null };
        const target: DateFieldState =
          date === null
            ? { ...state, day: null, month: null, year: null, typed: "" }
            : { ...state, day: date.day, month: date.month, year: date.year, typed: "" };
        const same =
          target.day === state.day && target.month === state.month && target.year === state.year;
        return same ? state : target;
      },
    },
  });
}

/** Declarative keymap for the segments (resolved by the adapter). */
export function dateFieldKeymap(config: DateFieldConfig): KeyBinding[] {
  const horizontal = (sign: 1 | -1): 1 | -1 =>
    (config.direction?.() ?? "ltr") === "rtl" ? (-sign as 1 | -1) : sign;
  return [
    {
      keys: "@printable",
      intent: (stroke) =>
        normalizeDigit(stroke.key) !== null
          ? dateFieldIntents.input({ digit: stroke.key }, "keyboard")
          : null,
    },
    { keys: "ArrowUp", intent: () => dateFieldIntents.increment({ delta: 1 }, "keyboard") },
    { keys: "ArrowDown", intent: () => dateFieldIntents.increment({ delta: -1 }, "keyboard") },
    {
      keys: "ArrowLeft",
      intent: () => dateFieldIntents.move({ direction: horizontal(-1) }, "keyboard"),
    },
    {
      keys: "ArrowRight",
      intent: () => dateFieldIntents.move({ direction: horizontal(1) }, "keyboard"),
    },
    { keys: "Backspace", intent: () => dateFieldIntents.backspace(undefined, "keyboard") },
    { keys: "Delete", intent: () => dateFieldIntents.deleteForward(undefined, "keyboard") },
    { keys: "Home", intent: () => dateFieldIntents.focusSegment({ index: 0 }, "keyboard") },
    {
      keys: "End",
      intent: () =>
        dateFieldIntents.focusSegment({ index: config.segments.length - 1 }, "keyboard"),
    },
  ];
}
