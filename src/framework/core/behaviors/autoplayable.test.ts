// @vitest-environment node
// Wave 9b — the carousel machine: [Focusable + Navigable(horizontal) +
// Autoplayable]. The rotation invariant is provable here without timers:
// a timer runs ⟺ playing && no suspension — every transition out of that
// state emits its cancel (the Toast anti-leak rule), announcements follow
// APG (only while rotation is off), and program sync stays silent.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable } from "./focusable";
import { navigable, navIntents, type NavigableSlice } from "./navigable";
import {
  autoplayable,
  autoplayIntents,
  cancelAdvance,
  scheduleAdvance,
  type AutoplayableSlice,
} from "./autoplayable";
import type { CollectionBehaviorConfig } from "./collection-config";
import { collectionFromArray } from "../collection/collection";
import { createStore } from "../runtime/store";
import { announce, emitEvent, type Effect } from "../runtime/effect";

const makeCarousel = (pageCount = 4, wrap = true) => {
  const pages = Array.from({ length: pageCount }, (_, i) => i);
  const collection = collectionFromArray(pages, {
    getKey: (page) => `page-${page}`,
    getTextValue: (page) => String(page + 1),
  });
  const config: CollectionBehaviorConfig & {
    interval: number;
    itemAnnouncement: (i: number, n: number) => string;
  } = {
    getCollection: () => collection,
    orientation: "horizontal",
    wrap,
    interval: 1000,
    itemAnnouncement: (i, n) => `Page ${i + 1} sur ${n}`,
  };
  const composed = composeMachine(
    "carousel",
    [focusable, navigable, autoplayable] as const,
    config,
  );
  const store = createStore(composed.machine);
  const effects: Effect[] = [];
  store.onEffect((e) => effects.push(e));
  const slice = () => store.getState().autoplayable as AutoplayableSlice;
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  const counts = () => ({
    schedule: effects.filter((e) => scheduleAdvance.match(e)).length,
    cancel: effects.filter((e) => cancelAdvance.match(e)).length,
  });
  return { store, effects, slice, focused, counts };
};

describe("autoplayable — the timer invariant (schedule ⟺ active)", () => {
  it("play schedules, pause cancels — exactly once each", () => {
    const { store, slice, counts } = makeCarousel();
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    expect(slice().playing).toBe(true);
    expect(counts()).toEqual({ schedule: 1, cancel: 0 });
    store.dispatch(autoplayIntents.play(undefined, "pointer")); // idempotent
    expect(counts()).toEqual({ schedule: 1, cancel: 0 });
    store.dispatch(autoplayIntents.pause(undefined, "pointer"));
    expect(counts()).toEqual({ schedule: 1, cancel: 1 });
    store.dispatch(autoplayIntents.pause(undefined, "pointer")); // idempotent
    expect(counts()).toEqual({ schedule: 1, cancel: 1 });
  });

  it("every suspension path cancels; the last resume reschedules", () => {
    const { store, counts, slice } = makeCarousel();
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    store.dispatch(autoplayIntents.suspend({ reason: "hover" }, "pointer"));
    expect(counts()).toEqual({ schedule: 1, cancel: 1 });
    store.dispatch(autoplayIntents.suspend({ reason: "focus" }, "keyboard"));
    // Already inactive: no second cancel (the timer is already dead).
    expect(counts()).toEqual({ schedule: 1, cancel: 1 });
    store.dispatch(autoplayIntents.resume({ reason: "hover" }, "pointer"));
    expect(counts()).toEqual({ schedule: 1, cancel: 1 }); // focus still holds
    store.dispatch(autoplayIntents.resume({ reason: "focus" }, "keyboard"));
    expect(counts()).toEqual({ schedule: 2, cancel: 1 });
    expect(slice().playing).toBe(true);
  });

  it("suspending while paused never schedules on resume", () => {
    const { store, counts } = makeCarousel();
    store.dispatch(autoplayIntents.suspend({ reason: "hidden" }, "program"));
    store.dispatch(autoplayIntents.resume({ reason: "hidden" }, "program"));
    expect(counts()).toEqual({ schedule: 0, cancel: 0 });
  });

  it("a navigation while active resets the cadence (cancel + schedule)", () => {
    const { store, counts } = makeCarousel();
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    store.dispatch(navIntents.next(undefined, "keyboard"));
    expect(counts()).toEqual({ schedule: 2, cancel: 1 });
  });

  it("a tick landing on the end of a non-wrapping track auto-pauses", () => {
    const { store, slice, counts, focused } = makeCarousel(3, false);
    store.dispatch(navIntents.move({ key: "page-2" }, "program"));
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    expect(counts()).toEqual({ schedule: 1, cancel: 0 });
    // The adapter timer fires nav/next (program); the track can't move.
    store.dispatch(navIntents.next(undefined, "program"));
    expect(focused()).toBe("page-2");
    expect(slice().playing).toBe(false);
    expect(counts()).toEqual({ schedule: 1, cancel: 1 });
  });

  it("wrap: the tick crosses the seam (page n-1 → 0) and keeps rotating", () => {
    const { store, focused, slice, counts } = makeCarousel(3, true);
    store.dispatch(navIntents.move({ key: "page-2" }, "program"));
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    store.dispatch(navIntents.next(undefined, "program"));
    expect(focused()).toBe("page-0");
    expect(slice().playing).toBe(true);
    expect(counts()).toEqual({ schedule: 2, cancel: 1 });
  });
});

describe("autoplayable — announcements & events (APG rules)", () => {
  const announcements = (effects: Effect[]) =>
    effects.filter((e) => announce.match(e)).map((e) => (e.payload as { message: string }).message);
  const pageChanges = (effects: Effect[]) =>
    effects
      .filter((e) => emitEvent.match(e))
      .filter((e) => (e.payload as { name: string }).name === "pageChange")
      .map((e) => (e.payload as { detail: { index: number } }).detail.index);

  it("announces page changes only while rotation is OFF", () => {
    const { store, effects } = makeCarousel();
    store.dispatch(navIntents.move({ key: "page-1" }, "pointer"));
    expect(announcements(effects)).toEqual(["Page 2 sur 4"]);
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    store.dispatch(navIntents.next(undefined, "program")); // autoplay tick
    expect(announcements(effects)).toEqual(["Page 2 sur 4"]); // unchanged
    store.dispatch(autoplayIntents.pause(undefined, "pointer"));
    store.dispatch(navIntents.next(undefined, "keyboard"));
    expect(announcements(effects)).toEqual(["Page 2 sur 4", "Page 4 sur 4"]);
  });

  it("emits pageChange for every real move — including autoplay ticks", () => {
    const { store, effects } = makeCarousel();
    store.dispatch(navIntents.first(undefined, "keyboard"));
    store.dispatch(autoplayIntents.play(undefined, "pointer"));
    store.dispatch(navIntents.next(undefined, "program")); // tick
    expect(pageChanges(effects)).toEqual([0, 1]);
  });

  it("program nav/move (controlled sync) is fully silent", () => {
    const { store, effects } = makeCarousel();
    store.dispatch(navIntents.move({ key: "page-2" }, "program"));
    expect(pageChanges(effects)).toEqual([]);
    expect(announcements(effects)).toEqual([]);
  });

  it("a move to the same page emits nothing", () => {
    const { store, effects } = makeCarousel();
    store.dispatch(navIntents.move({ key: "page-1" }, "pointer"));
    const before = effects.length;
    store.dispatch(navIntents.move({ key: "page-1" }, "pointer"));
    expect(effects.length).toBe(before);
  });
});
