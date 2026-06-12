import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import {
  createShortcutManager,
  ROOT_SCOPE,
  type ShortcutManager,
} from "../core/interaction/shortcuts";
import type { KeyStroke } from "../core/interaction/keys";
import { detectPlatform, strokeFromEvent } from "./useKeymap";
import { useLiveRef } from "./useMachine";

/**
 * Shortcut adapter — one window-level listener feeding the pure
 * ShortcutManager. Buttons can be triggered by global shortcuts without
 * holding focus; overlays mask page shortcuts by activating a blocking scope;
 * text inputs swallow printable strokes via `capturesText`.
 */

const ShortcutContext = createContext<ShortcutManager | null>(null);
const ScopeContext = createContext<string>(ROOT_SCOPE);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => createShortcutManager(detectPlatform()));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (manager.handle(strokeFromEvent(e))) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manager]);

  return <ShortcutContext.Provider value={manager}>{children}</ShortcutContext.Provider>;
}

export function useShortcutManager(): ShortcutManager | null {
  return useContext(ShortcutContext);
}

export interface ShortcutScopeProps {
  children: ReactNode;
  /** Modal scopes stop resolution from reaching ancestors. */
  blocking?: boolean;
  /** Text-editing scopes swallow printable strokes. */
  capturesText?: boolean;
  /** Whether this scope is currently the active resolution context. */
  active?: boolean;
}

export function ShortcutScope({
  children,
  blocking = false,
  capturesText = false,
  active = true,
}: ShortcutScopeProps) {
  const manager = useContext(ShortcutContext);
  const parentId = useContext(ScopeContext);
  const id = useId();

  useEffect(() => {
    if (!manager) return;
    const dispose = manager.defineScope({ id, parentId, blocking, capturesText });
    const deactivate = active ? manager.activate(id) : undefined;
    return () => {
      deactivate?.();
      dispose();
    };
  }, [manager, id, parentId, blocking, capturesText, active]);

  return <ScopeContext.Provider value={id}>{children}</ScopeContext.Provider>;
}

export interface UseShortcutOptions {
  /** Register on the root scope regardless of position in the tree. */
  global?: boolean;
  priority?: number;
  description?: string;
  enabled?: boolean;
  when?: () => boolean;
}

export function useShortcut(
  keys: string,
  run: (stroke: KeyStroke) => void,
  { global = false, priority = 0, description, enabled = true, when }: UseShortcutOptions = {},
): void {
  const manager = useContext(ShortcutContext);
  const scopeId = useContext(ScopeContext);
  const live = useLiveRef({ run, when });

  useEffect(() => {
    if (!manager || !enabled) return;
    return manager.register({
      keys,
      scopeId: global ? ROOT_SCOPE : scopeId,
      priority,
      description,
      when: () => live.current.when?.() ?? true,
      run: (stroke) => live.current.run(stroke),
    });
  }, [manager, keys, scopeId, global, priority, description, enabled, live]);
}
