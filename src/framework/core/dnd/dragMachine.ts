import { announce, emitEvent } from "../runtime/effect";
import { defineIntent } from "../runtime/intent";
import {
  createMachine,
  withEffects,
  type Machine,
  type TransitionResult,
} from "../runtime/machine";
import type { Key } from "../collection/collection";

/**
 * Drag machine — one pure machine for every drag & drop interaction
 * (Kanban cards, list reorder, tree moves). A drag is a journey:
 *
 *   drag/start → drag/over* → drag/drop | drag/cancel
 *
 * Zones are opaque string ids; geometry stays in the adapter (pointer
 * hit-testing or keyboard moves both end up as the same `drag/over` intents,
 * so mouse, touch, pen and keyboard DnD share one state model). The machine
 * never mutates data: `drop` emits a `move` event with from/to coordinates
 * and the host applies it. Every phase emits screen-reader announcements as
 * effects — accessible DnD by construction.
 */

export interface DragLocation {
  readonly zone: string;
  readonly index: number;
}

export interface DragActive extends DragLocation {
  readonly key: Key;
}

export interface DragState {
  readonly active: DragActive | null;
  readonly over: DragLocation | null;
  /** True when the drag was started from the keyboard. */
  readonly keyboard: boolean;
}

export interface DragConfig {
  /** Zone ids in visual order (keyboard left/right moves between them). */
  getZones(): readonly string[];
  /** Number of droppable positions in a zone (item count). */
  getZoneSize(zone: string): number;
  /** Human label for announcements. */
  getItemLabel?(key: Key): string;
  getZoneLabel?(zone: string): string;
}

export const dragIntents = {
  start: defineIntent<{ zone: string; key: Key; index: number }>("drag/start"),
  /** Hover/move the drop target. */
  over: defineIntent<DragLocation>("drag/over"),
  leave: defineIntent<void>("drag/leave"),
  /** Keyboard: move the target by deltas (zones and positions). */
  moveTarget: defineIntent<{ dZone?: number; dIndex?: number }>("drag/move-target"),
  drop: defineIntent<void>("drag/drop"),
  cancel: defineIntent<void>("drag/cancel"),
};

export interface DragMoveDetail {
  readonly key: Key;
  readonly fromZone: string;
  readonly fromIndex: number;
  readonly toZone: string;
  readonly toIndex: number;
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

export function createDragMachine(config: DragConfig): Machine<DragState> {
  const initialState: DragState = { active: null, over: null, keyboard: false };

  const label = (key: Key) => config.getItemLabel?.(key) ?? String(key);
  const zoneLabel = (zone: string) => config.getZoneLabel?.(zone) ?? zone;

  const overChanged = (
    state: DragState,
    over: DragLocation,
    say: boolean,
  ): TransitionResult<DragState> => {
    if (state.active === null) return state;
    if (state.over && state.over.zone === over.zone && state.over.index === over.index) {
      return state;
    }
    const next = { ...state, over };
    if (!say) return next;
    return withEffects(
      next,
      announce({
        message: `${label(state.active.key)}, position ${over.index + 1} in ${zoneLabel(over.zone)}`,
      }),
    );
  };

  return createMachine<DragState>({
    id: "drag",
    initialState,
    handlers: {
      [dragIntents.start.type]: (state, intent) => {
        if (state.active) return state;
        const { zone, key, index } = intent.payload as { zone: string; key: Key; index: number };
        const keyboard = intent.source === "keyboard";
        return withEffects(
          {
            active: { zone, key, index },
            // Keyboard drags target their own slot until moved.
            over: keyboard ? { zone, index } : null,
            keyboard,
          },
          emitEvent({ name: "dragStart", detail: { key, zone, index } }),
          announce({
            message: `${label(key)} picked up from ${zoneLabel(zone)}. Use arrow keys to move, Space to drop, Escape to cancel.`,
            politeness: "assertive",
          }),
        );
      },

      [dragIntents.over.type]: (state, intent) =>
        overChanged(state, intent.payload as DragLocation, false),

      [dragIntents.leave.type]: (state) =>
        state.active && state.over !== null ? { ...state, over: null } : state,

      [dragIntents.moveTarget.type]: (state, intent) => {
        if (!state.active) return state;
        const { dZone = 0, dIndex = 0 } = intent.payload as { dZone?: number; dIndex?: number };
        const zones = config.getZones();
        const current = state.over ?? { zone: state.active.zone, index: state.active.index };
        const zoneIndex = clamp(zones.indexOf(current.zone) + dZone, zones.length - 1);
        const zone = zones[zoneIndex] ?? current.zone;
        // Entering another zone: dropping appends by default at the pointer's
        // index; clamp to that zone's size (insertion slots = size + 1, minus
        // the dragged item when it comes from the same zone).
        const sameZone = zone === state.active.zone;
        const maxIndex = Math.max(0, config.getZoneSize(zone) - (sameZone ? 1 : 0));
        const baseIndex = zone === current.zone ? current.index : current.index;
        const index = clamp(baseIndex + dIndex, maxIndex);
        return overChanged(state, { zone, index }, true);
      },

      [dragIntents.drop.type]: (state) => {
        if (!state.active) return state;
        const to = state.over;
        if (!to) {
          // Dropped nowhere → behaves like cancel.
          return withEffects(
            initialState,
            emitEvent({ name: "dragCancel", detail: { key: state.active.key } }),
            announce({ message: `${label(state.active.key)} drag cancelled.` }),
          );
        }
        const detail: DragMoveDetail = {
          key: state.active.key,
          fromZone: state.active.zone,
          fromIndex: state.active.index,
          toZone: to.zone,
          toIndex: to.index,
        };
        const moved = detail.fromZone !== detail.toZone || detail.fromIndex !== detail.toIndex;
        return withEffects(
          initialState,
          ...(moved ? [emitEvent({ name: "move", detail })] : []),
          emitEvent({ name: "dragEnd", detail }),
          announce({
            message: moved
              ? `${label(detail.key)} dropped in ${zoneLabel(detail.toZone)}, position ${detail.toIndex + 1}.`
              : `${label(detail.key)} kept its position.`,
          }),
        );
      },

      [dragIntents.cancel.type]: (state) => {
        if (!state.active) return state;
        return withEffects(
          initialState,
          emitEvent({ name: "dragCancel", detail: { key: state.active.key } }),
          announce({ message: `${label(state.active.key)} drag cancelled.` }),
        );
      },
    },
  });
}
