// @vitest-environment node
// Calendar grid machine tested as a pure machine: intents in, state + effects out.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { announce, emitEvent, focusElement, type Effect } from "../runtime/effect";
import { resolveBinding } from "../interaction/keymap";
import type { KeyStroke } from "../interaction/keys";
import {
  calendarIntents,
  calendarKeymap,
  calendarRange,
  createCalendarMachine,
  type CalendarConfig,
  type CalendarState,
} from "./calendar";
import { dateValue, toISODate, type DateValue } from "./value";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const JUNE_12 = dateValue(2026, 6, 12); // a Friday

const makeCalendar = (config: Partial<CalendarConfig> = {}) => {
  const full: CalendarConfig = {
    initialFocus: JUNE_12,
    getFirstDayOfWeek: () => 1, // Monday (fr)
    monthLabel: (y, m) => `month:${y}-${m}`,
    ...config,
  };
  const store = createStore(createCalendarMachine(full));
  const keymap = calendarKeymap(full);
  const press = (s: KeyStroke): Effect[] => {
    const resolved = resolveBinding(keymap, s);
    return resolved ? [...store.dispatch(resolved.intent)] : [];
  };
  const state = () => store.getState() as CalendarState;
  return { store, press, state };
};

const focusTargets = (effects: readonly Effect[]) =>
  effects.filter(focusElement.match).map((e) => e.payload.target);
const announcements = (effects: readonly Effect[]) =>
  effects.filter(announce.match).map((e) => e.payload.message);
const eventNames = (effects: readonly Effect[]) =>
  effects.filter(emitEvent.match).map((e) => e.payload.name);

describe("calendar machine — arrows", () => {
  it("ArrowRight moves one day forward with a focus effect keyed by ISO date", () => {
    const { press, state } = makeCalendar();
    const effects = press(stroke("ArrowRight"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 13));
    expect(focusTargets(effects)).toEqual(["2026-06-13"]);
  });

  it("ArrowUp/ArrowDown move by whole weeks", () => {
    const { press, state } = makeCalendar();
    press(stroke("ArrowUp"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 5));
    press(stroke("ArrowDown"));
    press(stroke("ArrowDown"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 19));
  });

  it("crossing a month boundary follows with the visible month and announces it", () => {
    const { store, state } = makeCalendar();
    store.dispatch(calendarIntents.focusDate({ date: dateValue(2026, 6, 30) }, "keyboard"));
    const effects = store.dispatch(calendarIntents.moveDays({ days: 1 }, "keyboard"));
    expect(state().focusedDate).toEqual(dateValue(2026, 7, 1));
    expect(state().visibleMonth).toEqual({ year: 2026, month: 7 });
    expect(announcements(effects)).toEqual(["month:2026-7"]);
  });

  it("RTL flips ArrowLeft/ArrowRight", () => {
    const { press, state } = makeCalendar({ direction: () => "rtl" });
    press(stroke("ArrowLeft"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 13));
    press(stroke("ArrowRight"));
    expect(state().focusedDate).toEqual(JUNE_12);
  });
});

describe("calendar machine — Home/End/PageUp/PageDown", () => {
  it("Home/End jump to the locale week edges (Monday-first here)", () => {
    const { press, state } = makeCalendar();
    press(stroke("Home"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 8));
    press(stroke("End"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 14));
  });

  it("week edges follow the injected first day of week", () => {
    const { press, state } = makeCalendar({ getFirstDayOfWeek: () => 0 });
    press(stroke("Home"));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 7)); // Sunday
  });

  it("PageDown moves a month keeping the day; Shift+PageDown moves a year", () => {
    const { press, state } = makeCalendar();
    press(stroke("PageDown"));
    expect(state().focusedDate).toEqual(dateValue(2026, 7, 12));
    press(stroke("PageDown", { shift: true }));
    expect(state().focusedDate).toEqual(dateValue(2027, 7, 12));
    press(stroke("PageUp"));
    expect(state().focusedDate).toEqual(dateValue(2027, 6, 12));
  });

  it("paging from Jan 31 clamps to the shorter month", () => {
    const { store, press, state } = makeCalendar();
    store.dispatch(calendarIntents.focusDate({ date: dateValue(2026, 1, 31) }, "program"));
    press(stroke("PageDown"));
    expect(state().focusedDate).toEqual(dateValue(2026, 2, 28));
  });
});

describe("calendar machine — min/max & disabled", () => {
  it("focus never crosses min/max (clamped, not blocked)", () => {
    const { press, state } = makeCalendar({
      getMin: () => dateValue(2026, 6, 10),
      getMax: () => dateValue(2026, 6, 14),
    });
    press(stroke("ArrowDown")); // +7 → clamped to max
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 14));
    press(stroke("PageUp")); // -1 month → clamped to min
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 10));
  });

  it("disabled dates stay focusable but not selectable (APG)", () => {
    const disabled = dateValue(2026, 6, 13);
    const { store, press, state } = makeCalendar({
      isDateDisabled: (d) => toISODate(d) === toISODate(disabled),
    });
    press(stroke("ArrowRight"));
    expect(state().focusedDate).toEqual(disabled);
    const effects = press(stroke("Enter"));
    expect(state().selectedDate).toBeNull();
    expect(eventNames(effects)).toEqual([]);
    // Pointer selection of a disabled date is a no-op too.
    store.dispatch(calendarIntents.select({ date: disabled }, "pointer"));
    expect(state().selectedDate).toBeNull();
  });

  it("selecting outside min/max is rejected", () => {
    const { store, state } = makeCalendar({ getMax: () => dateValue(2026, 6, 14) });
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 20) }, "pointer"));
    expect(state().selectedDate).toBeNull();
  });
});

describe("calendar machine — selection", () => {
  it("Enter selects the focused date, emits change once and announces the label", () => {
    const { press, state } = makeCalendar({ dateLabel: (d) => `picked:${toISODate(d)}` });
    const effects = press(stroke("Enter"));
    expect(state().selectedDate).toEqual(JUNE_12);
    expect(eventNames(effects)).toEqual(["change"]);
    expect(announcements(effects)).toEqual(["picked:2026-06-12"]);
    // Re-selecting the same date emits nothing.
    expect(eventNames(press(stroke("Enter")))).toEqual([]);
  });

  it("Space selects like Enter", () => {
    const { press, state } = makeCalendar();
    press(stroke(" "));
    expect(state().selectedDate).toEqual(JUNE_12);
  });

  it("pointer select moves focus to the picked date and emits change with the date", () => {
    const { store, state } = makeCalendar();
    const effects = store.dispatch(
      calendarIntents.select({ date: dateValue(2026, 6, 25) }, "pointer"),
    );
    expect(state().selectedDate).toEqual(dateValue(2026, 6, 25));
    expect(state().focusedDate).toEqual(dateValue(2026, 6, 25));
    const change = effects.find(emitEvent.match);
    expect((change?.payload.detail as { date: DateValue }).date).toEqual(dateValue(2026, 6, 25));
  });
});

describe("calendar machine — range mode", () => {
  const makeRange = (config: Partial<CalendarConfig> = {}) =>
    makeCalendar({
      selectionMode: "range",
      rangeLabel: (s, e) => `range:${toISODate(s)}..${toISODate(e)}`,
      dateLabel: (d) => `anchor:${toISODate(d)}`,
      ...config,
    });

  it("first select anchors (no event), preview follows the focus", () => {
    const { store, press, state } = makeRange();
    const effects = press(stroke("Enter"));
    expect(state().anchor).toEqual(JUNE_12);
    expect(state().range).toBeNull();
    expect(eventNames(effects)).toEqual([]);
    expect(announcements(effects)).toEqual(["anchor:2026-06-12"]);
    // Moving the focus (hover dispatches focusDate, keyboard moves days)…
    store.dispatch(calendarIntents.focusDate({ date: dateValue(2026, 6, 18) }, "pointer"));
    // …extends the live preview, ordered.
    expect(calendarRange(state())).toEqual({ start: JUNE_12, end: dateValue(2026, 6, 18) });
  });

  it("second select commits ordered even when picked backwards", () => {
    const { store, state } = makeRange();
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 20) }, "pointer"));
    const effects = store.dispatch(
      calendarIntents.select({ date: dateValue(2026, 6, 5) }, "pointer"),
    );
    expect(state().anchor).toBeNull();
    expect(state().range).toEqual({ start: dateValue(2026, 6, 5), end: dateValue(2026, 6, 20) });
    const commit = effects.find(emitEvent.match);
    expect(commit?.payload.name).toBe("rangeChange");
    expect(announcements(effects)).toEqual(["range:2026-06-05..2026-06-20"]);
  });

  it("a same-day range is valid (start = end)", () => {
    const { press, state } = makeRange();
    press(stroke("Enter"));
    press(stroke("Enter"));
    expect(state().range).toEqual({ start: JUNE_12, end: JUNE_12 });
  });

  it("preview backwards is ordered too", () => {
    const { store, press, state } = makeRange();
    press(stroke("Enter")); // anchor June 12
    store.dispatch(calendarIntents.moveDays({ days: -7 }, "keyboard"));
    expect(calendarRange(state())).toEqual({ start: dateValue(2026, 6, 5), end: JUNE_12 });
  });

  it("Escape cancels a pending anchor, and falls through when none is pending", () => {
    const full: CalendarConfig = {
      initialFocus: JUNE_12,
      getFirstDayOfWeek: () => 1,
      selectionMode: "range",
    };
    const store = createStore(createCalendarMachine(full));
    const keymap = calendarKeymap(full, () => store.getState() as CalendarState);
    const escape = () => resolveBinding(keymap, stroke("Escape"));
    expect(escape()).toBeNull(); // no anchor → the binding falls through (overlays keep Escape)
    store.dispatch(calendarIntents.selectFocused(undefined, "keyboard"));
    const resolved = escape();
    expect(resolved).not.toBeNull();
    store.dispatch(resolved!.intent);
    expect((store.getState() as CalendarState).anchor).toBeNull();
    expect(escape()).toBeNull(); // cancelled → falls through again
  });

  it("starting a new selection clears the committed range", () => {
    const { store, state } = makeRange();
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 5) }, "pointer"));
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 8) }, "pointer"));
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 20) }, "pointer"));
    expect(state().range).toBeNull();
    expect(state().anchor).toEqual(dateValue(2026, 6, 20));
  });

  it("setRange (program) syncs silently, ordering swapped bounds", () => {
    const { store, state } = makeRange();
    const effects = store.dispatch(
      calendarIntents.setRange(
        { range: { start: dateValue(2026, 7, 10), end: dateValue(2026, 7, 2) } },
        "program",
      ),
    );
    expect(effects).toHaveLength(0);
    expect(state().range).toEqual({ start: dateValue(2026, 7, 2), end: dateValue(2026, 7, 10) });
    expect(state().visibleMonth).toEqual({ year: 2026, month: 7 });
    store.dispatch(calendarIntents.setRange({ range: null }, "program"));
    expect(state().range).toBeNull();
  });

  it("disabled dates can neither anchor nor commit", () => {
    const { store, state } = makeRange({
      isDateDisabled: (d) => toISODate(d) === "2026-06-13",
    });
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 13) }, "pointer"));
    expect(state().anchor).toBeNull();
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 10) }, "pointer"));
    store.dispatch(calendarIntents.select({ date: dateValue(2026, 6, 13) }, "pointer"));
    expect(state().range).toBeNull();
    expect(state().anchor).toEqual(dateValue(2026, 6, 10));
  });
});

describe("calendar machine — pointer month nav keeps DOM focus where it is", () => {
  it("pointer movePage announces the month but emits no focus effect", () => {
    const { store, state } = makeCalendar();
    const effects = store.dispatch(calendarIntents.movePage({ months: 1 }, "pointer"));
    expect(state().visibleMonth).toEqual({ year: 2026, month: 7 });
    expect(focusTargets(effects)).toEqual([]);
    expect(announcements(effects)).toEqual(["month:2026-7"]);
  });
});

describe("calendar machine — controlled sync is silent", () => {
  it("setValue (program) updates value + focus + month with zero effects", () => {
    const { store, state } = makeCalendar();
    const effects = store.dispatch(
      calendarIntents.setValue({ date: dateValue(2026, 9, 3) }, "program"),
    );
    expect(state().selectedDate).toEqual(dateValue(2026, 9, 3));
    expect(state().focusedDate).toEqual(dateValue(2026, 9, 3));
    expect(state().visibleMonth).toEqual({ year: 2026, month: 9 });
    expect(effects).toHaveLength(0);
  });

  it("setValue(null) clears without touching focus", () => {
    const { store, state } = makeCalendar();
    store.dispatch(calendarIntents.setValue({ date: dateValue(2026, 9, 3) }, "program"));
    store.dispatch(calendarIntents.setValue({ date: null }, "program"));
    expect(state().selectedDate).toBeNull();
    expect(state().focusedDate).toEqual(dateValue(2026, 9, 3));
  });

  it("program-sourced focus moves emit no DOM focus effect", () => {
    const { store } = makeCalendar();
    const effects = store.dispatch(
      calendarIntents.focusDate({ date: dateValue(2026, 8, 1) }, "program"),
    );
    expect(focusTargets(effects)).toEqual([]);
    expect(announcements(effects)).toEqual([]);
  });
});
