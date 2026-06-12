import { createMachine, toTransition, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { announce, emitEvent, focusElement, type Effect } from "../runtime/effect";
import type { KeyBinding } from "../behaviors/behavior";
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  endOfWeek,
  isDateInRange,
  isSameDay,
  startOfWeek,
  toISODate,
  type DateValue,
} from "./value";

/**
 * Calendar grid — a dedicated pure machine (like gridMachine and the PIN): a
 * logical focus moving over the 2D month grid.
 *
 * Arrows step days/weeks, Home/End jump to the week edges, PageUp/Down change
 * month (Shift: year) keeping the day stable; the visible month always follows
 * the focused date. Min/max clamp every move; disabled dates stay focusable
 * but not selectable (APG). Focus moves come back as declarative
 * `dom/focus-element` effects keyed by ISO date, month changes as polite SR
 * announcements — labels are localized by config getters, the machine never
 * touches Intl itself. Program-sourced intents (controlled sync) are silent:
 * no DOM focus, no announcements, no change event.
 */

export interface CalendarState {
  /** Logical focus in the grid (always within min/max). */
  readonly focusedDate: DateValue;
  /** Month shown by the grid — follows the focused date. */
  readonly visibleMonth: { readonly year: number; readonly month: number };
  readonly selectedDate: DateValue | null;
}

export interface CalendarConfig {
  /** Initial focus — usually the value, else today (injected: the core has no clock). */
  initialFocus: DateValue;
  defaultValue?: DateValue | null;
  /** Live getters — props are read at dispatch time, the machine is built once. */
  getFirstDayOfWeek?: () => number;
  getMin?: () => DateValue | null | undefined;
  getMax?: () => DateValue | null | undefined;
  isDateDisabled?: (date: DateValue) => boolean;
  /** Localized "June 2026" — announced when the visible month changes. */
  monthLabel?: (year: number, month: number) => string;
  /** Localized full date — announced on selection. */
  dateLabel?: (date: DateValue) => string;
  /** RTL flips ArrowLeft/ArrowRight (adapter-level semantics, RFC §3.6). */
  direction?: () => "ltr" | "rtl";
}

export const calendarIntents = {
  /** Move logical focus to a precise date (pointer hover-to-focus, month cells). */
  focusDate: defineIntent<{ date: DateValue }>("calendar/focus-date"),
  /** Step the focus by N days (arrows: ±1, ±7). */
  moveDays: defineIntent<{ days: number }>("calendar/move-days"),
  /** Jump to the start/end of the focused week (Home/End). */
  weekEdge: defineIntent<{ edge: "start" | "end" }>("calendar/week-edge"),
  /** Page by months/years (PageUp/Down, Shift = year), day kept stable (clamped). */
  movePage: defineIntent<{ months?: number; years?: number }>("calendar/move-page"),
  /** Select a date (pointer click). */
  select: defineIntent<{ date: DateValue }>("calendar/select"),
  /** Select the focused date (Enter/Space). */
  selectFocused: defineIntent<void>("calendar/select-focused"),
  /** Controlled-value sync — silent (no focus/announce/change echo). */
  setValue: defineIntent<{ date: DateValue | null }>("calendar/set-value"),
};

export function createCalendarMachine(config: CalendarConfig): Machine<CalendarState> {
  const min = () => config.getMin?.() ?? null;
  const max = () => config.getMax?.() ?? null;
  const firstDow = () => config.getFirstDayOfWeek?.() ?? 0;
  const monthLabel = (y: number, m: number) =>
    config.monthLabel?.(y, m) ?? `${y}-${String(m).padStart(2, "0")}`;

  const initialFocus = clampDate(config.initialFocus, min(), max());

  /** Move the logical focus; the visible month follows; month changes announce. */
  const focusTransition = (state: CalendarState, target: DateValue, source: string) => {
    const date = clampDate(target, min(), max());
    const monthChanged =
      date.year !== state.visibleMonth.year || date.month !== state.visibleMonth.month;
    if (isSameDay(date, state.focusedDate) && !monthChanged) return state;
    const next: CalendarState = {
      ...state,
      focusedDate: date,
      visibleMonth: { year: date.year, month: date.month },
    };
    const effects: Effect[] = [];
    // Keyboard moves drive DOM focus; pointer clicks already focused the cell
    // natively (and month-nav buttons must keep their own focus).
    if (source === "keyboard" || source === "shortcut") {
      effects.push(focusElement({ target: toISODate(date) }));
    }
    if (source !== "program" && monthChanged) {
      effects.push(announce({ message: monthLabel(date.year, date.month) }));
    }
    return withEffects(next, ...effects);
  };

  const selectTransition = (state: CalendarState, date: DateValue, source: string) => {
    if (!isDateInRange(date, min(), max())) return state;
    if (config.isDateDisabled?.(date)) return state;
    const moved = toTransition(focusTransition(state, date, source));
    if (isSameDay(date, state.selectedDate)) return moved;
    const next: CalendarState = { ...moved.state, selectedDate: date };
    const effects: Effect[] = [...moved.effects];
    if (source !== "program") {
      effects.push(emitEvent({ name: "change", detail: { date } }));
      if (config.dateLabel) {
        effects.push(announce({ message: config.dateLabel(date) }));
      }
    }
    return withEffects(next, ...effects);
  };

  return createMachine<CalendarState>({
    id: "calendar",
    initialState: {
      focusedDate: initialFocus,
      visibleMonth: { year: initialFocus.year, month: initialFocus.month },
      selectedDate: config.defaultValue ?? null,
    },
    handlers: {
      [calendarIntents.focusDate.type]: (state, intent) =>
        focusTransition(state, (intent.payload as { date: DateValue }).date, intent.source),

      [calendarIntents.moveDays.type]: (state, intent) =>
        focusTransition(
          state,
          addDays(state.focusedDate, (intent.payload as { days: number }).days),
          intent.source,
        ),

      [calendarIntents.weekEdge.type]: (state, intent) => {
        const { edge } = intent.payload as { edge: "start" | "end" };
        const target =
          edge === "start"
            ? startOfWeek(state.focusedDate, firstDow())
            : endOfWeek(state.focusedDate, firstDow());
        return focusTransition(state, target, intent.source);
      },

      [calendarIntents.movePage.type]: (state, intent) => {
        const { months = 0, years = 0 } = intent.payload as { months?: number; years?: number };
        const target = addYears(addMonths(state.focusedDate, months), years);
        return focusTransition(state, target, intent.source);
      },

      [calendarIntents.select.type]: (state, intent) =>
        selectTransition(state, (intent.payload as { date: DateValue }).date, intent.source),

      [calendarIntents.selectFocused.type]: (state, intent) =>
        selectTransition(state, state.focusedDate, intent.source),

      [calendarIntents.setValue.type]: (state, intent) => {
        const { date } = intent.payload as { date: DateValue | null };
        if (date === null) {
          return state.selectedDate === null ? state : { ...state, selectedDate: null };
        }
        if (isSameDay(date, state.selectedDate)) return state;
        return {
          ...state,
          selectedDate: date,
          focusedDate: clampDate(date, min(), max()),
          visibleMonth: { year: date.year, month: date.month },
        };
      },
    },
  });
}

/** Declarative grid keymap. ArrowLeft/Right flip in RTL; Space uses "Space". */
export function calendarKeymap(config: CalendarConfig): KeyBinding[] {
  const horizontal = (sign: 1 | -1): number =>
    (config.direction?.() ?? "ltr") === "rtl" ? -sign : sign;
  return [
    {
      keys: "ArrowLeft",
      intent: () => calendarIntents.moveDays({ days: horizontal(-1) }, "keyboard"),
    },
    {
      keys: "ArrowRight",
      intent: () => calendarIntents.moveDays({ days: horizontal(1) }, "keyboard"),
    },
    { keys: "ArrowUp", intent: () => calendarIntents.moveDays({ days: -7 }, "keyboard") },
    { keys: "ArrowDown", intent: () => calendarIntents.moveDays({ days: 7 }, "keyboard") },
    { keys: "Home", intent: () => calendarIntents.weekEdge({ edge: "start" }, "keyboard") },
    { keys: "End", intent: () => calendarIntents.weekEdge({ edge: "end" }, "keyboard") },
    { keys: "PageUp", intent: () => calendarIntents.movePage({ months: -1 }, "keyboard") },
    { keys: "PageDown", intent: () => calendarIntents.movePage({ months: 1 }, "keyboard") },
    { keys: "Shift+PageUp", intent: () => calendarIntents.movePage({ years: -1 }, "keyboard") },
    { keys: "Shift+PageDown", intent: () => calendarIntents.movePage({ years: 1 }, "keyboard") },
    { keys: "Enter", intent: () => calendarIntents.selectFocused(undefined, "keyboard") },
    { keys: "Space", intent: () => calendarIntents.selectFocused(undefined, "keyboard") },
  ];
}
