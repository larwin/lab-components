import {
  collectionFromArray,
  dismissable,
  focusable,
  navIntents,
  navigable,
  type Collection,
  type Key,
  type KeyBinding,
} from "@/framework/core";

/**
 * Menubar recipe (APG menubar pattern) — pure composition, no React.
 *
 * The bar itself is Focusable + Navigable(horizontal, wrap) + Dismissable:
 * `focusedKey` designates the active top-level menu and `open` says whether
 * its panel is showing — "move to the next menu while open" is just
 * `nav/next` with the panel following the focus. The panels reuse the Menu
 * machine (menu-core) untouched, one collection per top-level menu.
 */

export interface MenubarMenuDef {
  key: Key;
  label: string;
  disabled?: boolean;
}

export const menubarBehaviors = [focusable, navigable, dismissable] as const;

export function menubarCollection(menus: readonly MenubarMenuDef[]): Collection<MenubarMenuDef> {
  return collectionFromArray(menus, {
    getKey: (menu) => menu.key,
    getTextValue: (menu) => menu.label,
    isDisabled: (menu) => menu.disabled === true,
  });
}

/**
 * Extra bindings active *inside an open panel*, dispatched to the menubar
 * machine: ← → jump to the previous/next menu (the panel follows the bar's
 * focus). Resolved before the panel's own keymap.
 */
export function menubarPanelBindings(): KeyBinding[] {
  return [
    { keys: "ArrowRight", intent: () => navIntents.next(undefined, "keyboard") },
    { keys: "ArrowLeft", intent: () => navIntents.previous(undefined, "keyboard") },
  ];
}
