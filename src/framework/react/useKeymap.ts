import { useCallback } from "react";
import type { KeyBinding } from "../core/behaviors/behavior";
import type { Intent } from "../core/runtime/intent";
import type { KeyStroke, Platform } from "../core/interaction/keys";
import { resolveBinding } from "../core/interaction/keymap";
import { useLiveRef } from "./useMachine";

/**
 * Keymap adapter — turns a machine's declarative key bindings into a single
 * React onKeyDown handler. Resolution itself is pure (core/interaction/keymap).
 */

export { resolveBinding };

export function strokeFromEvent(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  timeStamp: number;
}): KeyStroke {
  return {
    key: e.key,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
    shift: e.shiftKey,
    at: e.timeStamp,
  };
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform ?? "";
  if (/mac|iphone|ipad|ipod/i.test(platform)) return "mac";
  if (/win/i.test(platform)) return "windows";
  if (/linux/i.test(platform)) return "linux";
  return "other";
}

export function useKeymap(
  getBindings: () => KeyBinding[],
  dispatch: (intent: Intent) => void,
  platform: Platform = detectPlatform(),
): (e: React.KeyboardEvent) => void {
  const live = useLiveRef({ getBindings, dispatch, platform });
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const { getBindings, dispatch, platform } = live.current;
      const resolved = resolveBinding(getBindings(), strokeFromEvent(e), platform);
      if (!resolved) return;
      if (resolved.binding.preventDefault !== false) e.preventDefault();
      dispatch(resolved.intent);
    },
    [live],
  );
}
