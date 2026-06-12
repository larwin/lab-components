import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  composeMachine,
  dismissIntents,
  navIntents,
  type Collection,
  type CollectionBehaviorConfig,
  type DismissableSlice,
  type DismissReason,
  type Key,
  type NavigableSlice,
} from "@/framework/core";
import {
  createItemRegistry,
  detectPlatform,
  Overlay,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";
import { MenuPanel } from "./Menu";
import { menuBehaviors, menuCollection, type MenuSectionDef } from "./menu-core";

/**
 * ContextMenu — the exact same machine as Menu (Focusable + Navigable +
 * Actionable + Dismissable); only the trigger differs: right-click (or the
 * keyboard Menu key / Shift+F10) opens it at the pointer, via an invisible
 * 0×0 anchor placed at the click coordinates and positioned by the same
 * overlay core.
 */

export interface ContextMenuProps {
  /** The surface that owns the right-click. */
  children: ReactNode;
  sections: MenuSectionDef[];
  onAction: (key: Key) => void;
  className?: string;
}

export function ContextMenu({ children, sections, onAction, className }: ContextMenuProps) {
  const baseId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [platform] = useState(detectPlatform);

  const collection = useMemo(() => menuCollection(sections), [sections]);

  const live = useLiveRef({ collection, onAction });
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.collection as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("contextmenu", menuBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const open = (state.dismissable as DismissableSlice).open;

  useForgeEffects(store, {
    registry,
    events: {
      action: (detail) => {
        live.current.onAction((detail as { key: Key }).key);
        dispatch(dismissIntents.close({ reason: "select" }, "program"));
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const openAt = (x: number, y: number, source: "pointer" | "keyboard") => {
    setPoint({ x, y });
    // Re-opening at a new point: close first so the overlay re-anchors cleanly.
    if (open) dispatch(dismissIntents.close(undefined, source));
    dispatch(dismissIntents.open(undefined, source));
    dispatch(navIntents.first(undefined, source));
  };

  return (
    <>
      <div
        className={className}
        onContextMenu={(e) => {
          e.preventDefault();
          openAt(e.clientX, e.clientY, "pointer");
        }}
        onKeyDown={(e) => {
          // Keyboard path: the Menu key, or Shift+F10 (APG).
          if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            openAt(rect.x + rect.width / 2, rect.y + rect.height / 2, "keyboard");
          }
        }}
      >
        {children}
      </div>

      {point && (
        <div
          ref={anchorRef}
          aria-hidden
          style={{ position: "fixed", left: point.x, top: point.y, width: 0, height: 0 }}
        />
      )}

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={2}
      >
        <MenuPanel
          baseId={baseId}
          collection={collection}
          focusedKey={nav.focusedKey}
          registry={registry}
          dispatch={dispatch}
          onKeyDown={onKeyDown}
          platform={platform}
        />
      </Overlay>
    </>
  );
}
