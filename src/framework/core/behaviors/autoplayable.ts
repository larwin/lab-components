import { defineBehavior, type BehaviorContext } from "./behavior";
import { defineIntent, type Intent } from "../runtime/intent";
import { announce, defineEffect, emitEvent } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";
import type { Effect } from "../runtime/effect";
import type { Key } from "../collection/collection";
import { navIntents, type NavigableSlice } from "./navigable";
import { visibleKeysOf, type CollectionBehaviorConfig } from "./collection-config";

/**
 * Autoplayable — timed rotation over a Navigable collection (carousel,
 * rotating banner). A genuinely new state domain: "the machine advances by
 * itself" — but the advancing itself is plain `nav/next`, so keyboard,
 * pointer, dots and the timer all converge on the same intents.
 *
 * Timers follow the Toast pattern: the reducer only emits declarative
 * `autoplay/schedule-advance` / `autoplay/cancel-advance` effect pairs and
 * the adapter owns `setTimeout`. The invariant is provable in Node: a timer
 * is running ⟺ `playing && suspensions.size === 0` — every transition out of
 * that state emits its cancel (the Toast anti-leak lesson).
 *
 * APG rotation rules encoded here, not in shells:
 *  - page changes are announced to screen readers ONLY while rotation is
 *    inactive (auto-rotation announcements are noise);
 *  - a programmatic `nav/move` (controlled-prop sync) is fully silent — no
 *    announcement, no event echo;
 *  - a timer tick that lands on the end of a non-wrapping collection pauses
 *    the rotation (and cancels its timer) instead of spinning silently.
 */

export type AutoplaySuspendReason = "hover" | "focus" | "hidden";

export interface AutoplayableSlice {
  /** User/program intent to rotate. */
  readonly playing: boolean;
  /** Temporary holds (hover, focus, hidden tab) — rotation resumes after. */
  readonly suspensions: ReadonlySet<AutoplaySuspendReason>;
}

export interface AutoplayableConfig {
  /** Delay between automatic advances, ms. Default 4000. */
  interval?: number;
  /** Localized SR announcement for the current item (index is 0-based). */
  itemAnnouncement?: (index: number, count: number) => string;
}

export const autoplayIntents = {
  play: defineIntent<void>("autoplay/play"),
  pause: defineIntent<void>("autoplay/pause"),
  toggle: defineIntent<void>("autoplay/toggle"),
  suspend: defineIntent<{ reason: AutoplaySuspendReason }>("autoplay/suspend"),
  resume: defineIntent<{ reason: AutoplaySuspendReason }>("autoplay/resume"),
};

/** Ask the adapter to fire `nav/next` (source "program") after `delayMs`. */
export const scheduleAdvance = defineEffect<{ delayMs: number }>("autoplay/schedule-advance");
/** Clear the pending advance, if any (idempotent at the adapter). */
export const cancelAdvance = defineEffect<void>("autoplay/cancel-advance");

const isActive = (slice: AutoplayableSlice): boolean =>
  slice.playing && slice.suspensions.size === 0;

const EMPTY_SUSPENSIONS: ReadonlySet<AutoplaySuspendReason> = new Set();

type Config = CollectionBehaviorConfig & AutoplayableConfig;

const intervalOf = (config: Config): number => config.interval ?? 4000;

/** Emit the schedule/cancel pair implied by an active→inactive (or reverse) transition. */
const transition = (
  prev: AutoplayableSlice,
  next: AutoplayableSlice,
  config: Config,
): TransitionResult<AutoplayableSlice> => {
  const was = isActive(prev);
  const is = isActive(next);
  if (was === is) return next === prev ? prev : next;
  return withEffects(next, is ? scheduleAdvance({ delayMs: intervalOf(config) }) : cancelAdvance());
};

/** Shared reaction to navigation: reset the timer, announce, emit pageChange. */
const followNavigation = (
  slice: AutoplayableSlice,
  intent: Intent<never>,
  ctx: BehaviorContext<Config>,
): TransitionResult<AutoplayableSlice> => {
  const before = ctx.readInitial<NavigableSlice>("navigable")?.focusedKey ?? null;
  const after = ctx.read<NavigableSlice>("navigable")?.focusedKey ?? null;
  const active = isActive(slice);

  if (after === before) {
    // A timer tick that didn't move = the end of a non-wrapping collection:
    // stop rotating instead of ticking forever in place.
    if (active && intent.type === navIntents.next.type && intent.source === "program") {
      return withEffects({ ...slice, playing: false }, cancelAdvance());
    }
    return slice;
  }

  const effects: Effect[] = [];
  const silentSync = intent.type === navIntents.move.type && intent.source === "program";

  if (active) {
    // Any real move resets the cadence (manual interaction included).
    effects.push(cancelAdvance(), scheduleAdvance({ delayMs: intervalOf(ctx.config) }));
  }

  if (!silentSync) {
    const keys = visibleKeysOf(ctx);
    const items = keys.filter((k) => ctx.config.getCollection().getNode(k)?.kind === "item");
    const index = after !== null ? items.indexOf(after) : -1;
    if (index >= 0) {
      effects.push(emitEvent({ name: "pageChange", detail: { key: after as Key, index } }));
      // APG: announce only while rotation is off — auto-rotation is noise.
      if (!active && ctx.config.itemAnnouncement) {
        effects.push(announce({ message: ctx.config.itemAnnouncement(index, items.length) }));
      }
    }
  }

  return effects.length > 0 ? withEffects(slice, ...effects) : slice;
};

export const autoplayable = defineBehavior<"autoplayable", AutoplayableSlice, Config>({
  name: "autoplayable",
  initial: () => ({ playing: false, suspensions: EMPTY_SUSPENSIONS }),
  handlers: {
    [autoplayIntents.play.type]: (slice, _intent, ctx) =>
      slice.playing ? slice : transition(slice, { ...slice, playing: true }, ctx.config),
    [autoplayIntents.pause.type]: (slice, _intent, ctx) =>
      slice.playing ? transition(slice, { ...slice, playing: false }, ctx.config) : slice,
    [autoplayIntents.toggle.type]: (slice, _intent, ctx) =>
      transition(slice, { ...slice, playing: !slice.playing }, ctx.config),
    [autoplayIntents.suspend.type]: (slice, intent, ctx) => {
      const { reason } = intent.payload as { reason: AutoplaySuspendReason };
      if (slice.suspensions.has(reason)) return slice;
      const suspensions = new Set(slice.suspensions);
      suspensions.add(reason);
      return transition(slice, { ...slice, suspensions }, ctx.config);
    },
    [autoplayIntents.resume.type]: (slice, intent, ctx) => {
      const { reason } = intent.payload as { reason: AutoplaySuspendReason };
      if (!slice.suspensions.has(reason)) return slice;
      const suspensions = new Set(slice.suspensions);
      suspensions.delete(reason);
      return transition(slice, { ...slice, suspensions }, ctx.config);
    },

    [navIntents.next.type]: followNavigation,
    [navIntents.previous.type]: followNavigation,
    [navIntents.first.type]: followNavigation,
    [navIntents.last.type]: followNavigation,
    [navIntents.move.type]: followNavigation,
  },
});
