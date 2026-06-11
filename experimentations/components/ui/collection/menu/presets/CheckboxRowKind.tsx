import React from 'react';
import { MENU_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import { createJSXKind } from '@/components/ui/collection/virtual/kind/jsx-kind';
import { buildMenuKindClassName, resolveMenuIcon, resolveMenuLabel } from './shared';

interface MenuCheckboxDescriptor extends ItemDescriptor {
  label: string;
  icon: string | null;
  isChecked: boolean;
  isDisabled: boolean;
}

function MenuCheckboxRow({ label, icon, isChecked, isDisabled }: MenuCheckboxDescriptor) {
  return (
    <>
      {icon && <span className="menu-kind__icon material-symbols-outlined" aria-hidden="true">{icon}</span>}
      <input
        type="checkbox"
        className="menu-kind__checkbox"
        checked={isChecked}
        onChange={() => {}}
        disabled={isDisabled}
        data-list-checkbox="true"
      />
      <span className="menu-kind__label">{label}</span>
    </>
  );
}

export interface CheckboxKindOptions {
  height?: number;
}

export function createCheckboxKind<TId extends ItemId = ItemId>(
  options: CheckboxKindOptions = {}
): AnyRowKindDefinition<MenuItemDefinition<TId>, TId> {
  return createJSXKind<MenuItemDefinition<TId>, TId, MenuCheckboxDescriptor>({
    kind: 'checkbox',
    height: options.height ?? MENU_ITEM_HEIGHT,
    computeDescriptor(item, id, runtime) {
      return {
        label: resolveMenuLabel(item.label, String(id)),
        icon: resolveMenuIcon(item.icon),
        isChecked: runtime.isChecked,
        isDisabled: runtime.isDisabled,
        className: buildMenuKindClassName('menu-kind--checkbox', runtime, { checked: runtime.isChecked }),
      };
    },
    Component: MenuCheckboxRow,
  });
}




