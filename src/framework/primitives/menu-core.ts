import {
  actionable,
  createCollection,
  dismissable,
  focusable,
  navigable,
  type Collection,
  type CollectionSourceNode,
  type Key,
} from "@/framework/core";
import type { ReactNode } from "react";

/**
 * Shared machine recipe for menus: Menu (trigger button) and ContextMenu
 * (right-click at pointer) compose the exact same behaviors over the exact
 * same collection shape — only the trigger differs.
 */

export interface MenuItemDef {
  key: Key;
  label: string;
  icon?: ReactNode;
  /** Display-only shortcut hint (e.g. "Mod+S"). */
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface MenuSectionDef {
  label?: string;
  items: MenuItemDef[];
}

export const menuBehaviors = [focusable, navigable, actionable, dismissable] as const;

/** Builds the sections/separators collection consumed by the menu machine. */
export function menuCollection(sections: MenuSectionDef[]): Collection<MenuItemDef | string> {
  const source: CollectionSourceNode<MenuItemDef | string>[] = sections.map((section, index) => ({
    key: `__section-${index}`,
    value: section.label ?? "",
    kind: "section",
    children: section.items.map((item) => ({
      key: item.key,
      value: item,
      textValue: item.label,
      disabled: item.disabled,
    })),
  }));
  return createCollection(source);
}
