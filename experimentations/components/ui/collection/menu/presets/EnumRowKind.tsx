import React from 'react';
import { MENU_EXTENDED_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { MenuEnumItemDefinition, MenuItemDefinition } from '@/core/collection/menu/types';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import { createJSXKind } from '@/components/ui/collection/virtual/kind/jsx-kind';
import { buildMenuKindClassName, resolveMenuIcon, resolveMenuLabel } from './shared';

interface MenuEnumDescriptor extends ItemDescriptor {
  label: string;
  icon: string | null;
  values: string[];
  selectedValues: string[];
  isDisabled: boolean;
}

function MenuEnumRow({ label, icon, values, selectedValues, isDisabled }: MenuEnumDescriptor) {
  const selected = new Set(selectedValues);

  return (
    <>
      {icon && <span className="menu-kind__icon material-symbols-outlined" aria-hidden="true">{icon}</span>}
      {label && <span className="menu-kind__label">{label}</span>}
      <div className="menu-kind__enum-values">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className={selected.has(value) ? 'menu-kind__enum-option is-selected' : 'menu-kind__enum-option'}
            data-menu-enum-value={value}
            disabled={isDisabled}
          >
            {value}
          </button>
        ))}
      </div>
    </>
  );
}

function isEnumItem<TId extends ItemId>(item: MenuItemDefinition<TId>): item is MenuEnumItemDefinition<TId> {
  return item.kind === 'enum';
}

export interface EnumKindOptions {
  height?: number;
}

export function createEnumKind<TId extends ItemId = ItemId>(
  options: EnumKindOptions = {}
): AnyRowKindDefinition<MenuItemDefinition<TId>, TId> {
  return createJSXKind<MenuItemDefinition<TId>, TId, MenuEnumDescriptor>({
    kind: 'enum',
    height: options.height ?? MENU_EXTENDED_ITEM_HEIGHT,
    computeDescriptor(item, id, runtime) {
      return {
        label: resolveMenuLabel(item.label, String(id)),
        icon: resolveMenuIcon(item.icon),
        values: isEnumItem(item) ? item.values : [],
        selectedValues: isEnumItem(item) ? (item.selectedValues ?? []) : [],
        isDisabled: runtime.isDisabled,
        className: buildMenuKindClassName('menu-kind--enum', runtime),
      };
    },
    Component: MenuEnumRow,
  });
}




