import { useEffect } from "react";
import {
  announce,
  emitEvent,
  focusElement,
  restoreFocus,
  scrollToItem,
} from "../core/runtime/effect";
import type { Effect } from "../core/runtime/effect";
import type { Store } from "../core/runtime/store";
import { useLiveRef } from "./useMachine";

/**
 * Effect interpreters — where declarative core effects meet the real DOM.
 * The core says `dom/focus-element`; this module actually calls `.focus()`.
 * Components can override any interpreter (e.g. a virtualized grid replaces
 * `dom/scroll-to-item` with virtualizer math).
 */

export type EffectInterpreter = (effect: Effect) => void;
export type EventHandlers = Record<string, (detail: unknown) => void>;

/* ---- live region (screen reader announcements) ---- */

let liveRegion: HTMLElement | null = null;
const ensureLiveRegion = (politeness: "polite" | "assertive"): HTMLElement => {
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    liveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(liveRegion);
  }
  liveRegion.setAttribute("aria-live", politeness);
  return liveRegion;
};

export const announceNow = (
  message: string,
  politeness: "polite" | "assertive" = "polite",
): void => {
  const region = ensureLiveRegion(politeness);
  region.textContent = "";
  // Re-set on the next frame so repeated identical messages are re-announced.
  requestAnimationFrame(() => {
    region.textContent = message;
  });
};

/* ---- focus restore stack (overlays) ---- */

const focusStack: HTMLElement[] = [];
export const pushFocusRestore = (): void => {
  const active = document.activeElement;
  if (active instanceof HTMLElement) focusStack.push(active);
};
const popFocusRestore = (): void => {
  const el = focusStack.pop();
  if (el && el.isConnected) el.focus();
};

/* ---- registry: collection keys → DOM elements ---- */

export interface ItemRegistry {
  register(key: string): (el: HTMLElement | null) => void;
  get(key: string): HTMLElement | undefined;
}

export function createItemRegistry(): ItemRegistry {
  const map = new Map<string, HTMLElement>();
  // Ref callbacks are cached per key so memoized items keep stable props.
  const callbacks = new Map<string, (el: HTMLElement | null) => void>();
  return {
    register: (key) => {
      let callback = callbacks.get(key);
      if (!callback) {
        callback = (el) => {
          if (el) map.set(key, el);
          else map.delete(key);
        };
        callbacks.set(key, callback);
      }
      return callback;
    },
    get: (key) => map.get(key),
  };
}

/* ---- the interpreter hook ---- */

export interface UseForgeEffectsOptions {
  /** Maps `event/emit` names to userland callbacks (press → onPress…). */
  events?: EventHandlers;
  /** Resolves `dom/focus-element` and default `dom/scroll-to-item` targets. */
  registry?: ItemRegistry;
  /** Override interpreters per effect type (virtualized scroll, custom focus…). */
  overrides?: Record<string, EffectInterpreter>;
}

export function useForgeEffects<S>(store: Store<S>, options: UseForgeEffectsOptions): void {
  const live = useLiveRef(options);

  useEffect(
    () =>
      store.onEffect((effect) => {
        const { events, registry, overrides } = live.current;
        const override = overrides?.[effect.type];
        if (override) {
          override(effect);
          return;
        }
        if (emitEvent.match(effect)) {
          events?.[effect.payload.name]?.(effect.payload.detail);
        } else if (focusElement.match(effect)) {
          registry?.get(effect.payload.target)?.focus();
        } else if (scrollToItem.match(effect)) {
          // Optional call: not implemented in jsdom test environments.
          registry?.get(effect.payload.key)?.scrollIntoView?.({ block: "nearest" });
        } else if (announce.match(effect)) {
          announceNow(effect.payload.message, effect.payload.politeness);
        } else if (restoreFocus.match(effect)) {
          popFocusRestore();
        }
      }),
    [store, live],
  );
}
