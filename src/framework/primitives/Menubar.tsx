import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import {
  actionable,
  composeMachine,
  dismissIntents,
  focusable,
  navIntents,
  navigable,
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
import { menuCollection, type MenuSectionDef } from "./menu-core";
import { MenuPanel } from "./Menu";
import { menubarBehaviors, menubarCollection, menubarPanelBindings } from "./menubar-core";

/**
 * Menubar — the APG menubar pattern as two cooperating machines (see
 * menubar-core): the bar (Navigable horizontal + Dismissable — the open
 * panel *is* the bar's focusedKey) and one panel machine reusing the Menu
 * composition over whichever menu is active. ← → inside an open panel are
 * bar intents: the panel follows the focus without closing; hovering another
 * trigger while open does the same through `nav/move`.
 */

export interface MenubarMenu {
  key: Key;
  label: string;
  disabled?: boolean;
  sections: MenuSectionDef[];
}

export interface MenubarProps {
  menus: readonly MenubarMenu[];
  onAction: (menuKey: Key, itemKey: Key) => void;
  className?: string;
  "aria-label"?: string;
}

const panelBehaviors = [focusable, navigable, actionable] as const;

export function Menubar({ menus, onAction, className, ...rest }: MenubarProps) {
  const baseId = useId();
  const [platform] = useState(detectPlatform);
  const [triggerRegistry] = useState(createItemRegistry);
  const [panelRegistry] = useState(createItemRegistry);

  const barCollection = menubarCollection(menus);
  const collections = new Map(menus.map((m) => [m.key, menuCollection(m.sections)]));
  const [emptyCollection] = useState(() => menuCollection([]));
  const live = useLiveRef({ barCollection, collections, menus, onAction, emptyCollection });

  /* ── the bar machine ────────────────────────────────────────────────── */
  const bar = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => live.current.barCollection as Collection<unknown>,
      orientation: "horizontal",
      wrap: true,
    };
    return composeMachine("menubar", menubarBehaviors, config);
  });

  const barNav = bar.state.navigable as NavigableSlice;
  const open = (bar.state.dismissable as DismissableSlice).open;
  const activeKey = barNav.focusedKey ?? menus.find((m) => !m.disabled)?.key ?? null;
  const liveActive = useLiveRef(activeKey);

  /* ── the panel machine: the Menu composition over the active menu ───── */
  const panel = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () =>
        ((liveActive.current !== null
          ? live.current.collections.get(liveActive.current)
          : undefined) ?? live.current.emptyCollection) as Collection<unknown>,
      wrap: true,
    };
    return composeMachine("menubar-panel", panelBehaviors, config);
  });

  const panelNav = panel.state.navigable as NavigableSlice;

  /* Moving across the bar while open: the new panel starts on its first item. */
  useEffect(() => {
    if (open && activeKey !== null) {
      panel.dispatch(navIntents.first(undefined, "program"));
    }
  }, [open, activeKey, panel]);

  /* The bar's scrollToItem is "focus that trigger" (roving DOM focus). */
  useForgeEffects(bar.store, {
    events: {},
    overrides: {
      "dom/scroll-to-item": (effect) => {
        triggerRegistry.get((effect.payload as { key: Key }).key)?.focus();
      },
    },
  });

  useForgeEffects(panel.store, {
    registry: panelRegistry,
    events: {
      action: (detail) => {
        const itemKey = (detail as { key: Key }).key;
        if (liveActive.current !== null) live.current.onAction(liveActive.current, itemKey);
        bar.dispatch(dismissIntents.close({ reason: "select" }, "program"));
      },
    },
  });

  /* ── keymaps ────────────────────────────────────────────────────────── */
  // On a trigger (closed bar): ← → / Home / End / typeahead travel the bar.
  const barOnKeyDown = useKeymap(() => bar.composed.keymap(bar.store.getState()), bar.dispatch);
  // Inside an open panel: ← → switch menus, Escape closes — bar intents.
  const panelBarKeys = useKeymap(
    () => [
      ...menubarPanelBindings(),
      ...bar.composed.keymap(bar.store.getState()).filter((b) => b.keys === "Escape"),
    ],
    bar.dispatch,
  );
  const panelOwnKeys = useKeymap(
    () => panel.composed.keymap(panel.store.getState()),
    panel.dispatch,
  );
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    panelBarKeys(e);
    if (!e.defaultPrevented) panelOwnKeys(e);
  };

  const openMenu = (key: Key, source: "keyboard" | "pointer") => {
    bar.dispatch(navIntents.move({ key }, source));
    bar.dispatch(dismissIntents.open(undefined, source));
    panel.dispatch(navIntents.first(undefined, source));
  };

  /* Stable anchor proxy: the Overlay tracks whichever trigger is active. */
  const anchorProxy = useRef({
    get current() {
      return liveActive.current !== null ? (triggerRegistry.get(liveActive.current) ?? null) : null;
    },
  }).current;

  const activeCollection = activeKey !== null ? collections.get(activeKey) : undefined;

  return (
    <>
      <div
        role="menubar"
        aria-label={rest["aria-label"] ?? "Barre de menus"}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1",
          className,
        )}
      >
        {menus.map((menu) => {
          const isActive = menu.key === activeKey;
          const isOpen = open && isActive;
          return (
            <button
              key={menu.key}
              ref={triggerRegistry.register(menu.key)}
              type="button"
              role="menuitem"
              id={`${baseId}-${menu.key}-trigger`}
              tabIndex={isActive ? 0 : -1}
              disabled={menu.disabled}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={isOpen ? `${baseId}-${menu.key}-menu` : undefined}
              onClick={() => {
                if (isOpen) bar.dispatch(dismissIntents.close(undefined, "pointer"));
                else openMenu(menu.key, "pointer");
              }}
              onPointerEnter={() => {
                // Hover opens only when a sibling menu is already open (APG).
                if (open && !menu.disabled && !isActive) {
                  bar.dispatch(navIntents.move({ key: menu.key }, "pointer"));
                }
              }}
              onFocus={() => bar.dispatch(navIntents.move({ key: menu.key }, "pointer"))}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openMenu(menu.key, "keyboard");
                  return;
                }
                barOnKeyDown(e);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                isOpen && "bg-muted",
                menu.disabled && "pointer-events-none opacity-50",
              )}
            >
              {menu.label}
            </button>
          );
        })}
      </div>

      <Overlay
        open={open && activeCollection !== undefined}
        onDismiss={(reason: DismissReason) =>
          bar.dispatch(dismissIntents.close({ reason }, "program"))
        }
        anchorRef={anchorProxy}
        placement="bottom-start"
        offset={4}
      >
        {activeKey !== null && activeCollection && (
          <MenuPanel
            key={activeKey}
            baseId={`${baseId}-${activeKey}`}
            collection={activeCollection}
            focusedKey={panelNav.focusedKey}
            registry={panelRegistry}
            dispatch={panel.dispatch}
            onKeyDown={onPanelKeyDown}
            platform={platform}
            labelledBy={`${baseId}-${activeKey}-trigger`}
          />
        )}
      </Overlay>
    </>
  );
}
