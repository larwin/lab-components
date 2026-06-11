import React from 'react';
import { MENU_EXTENDED_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { MenuInputItemDefinition, MenuInputType, MenuItemDefinition } from '@/core/collection/menu/types';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import { createJSXKind } from '@/components/ui/collection/virtual/kind/jsx-kind';
import { buildMenuKindClassName, resolveMenuIcon, resolveMenuLabel } from './shared';

interface MenuInputDescriptor extends ItemDescriptor {
  label: string;
  icon: string | null;
  value: string;
  placeholder: string;
  inputType: MenuInputType;
  isDisabled: boolean;
}

function MenuInputRow({ label, icon, value, placeholder, inputType, isDisabled }: MenuInputDescriptor) {
  return (
    <>
      {icon && <span className="menu-kind__icon material-symbols-outlined" aria-hidden="true">{icon}</span>}
      {label && <span className="menu-kind__label">{label}</span>}
      <input
        className="menu-kind__input"
        type={inputType}
        value={value}
        placeholder={placeholder}
        disabled={isDisabled}
        onChange={() => {}}
        data-menu-input="true"
      />
    </>
  );
}

function isInputItem<TId extends ItemId>(item: MenuItemDefinition<TId>): item is MenuInputItemDefinition<TId> {
  return item.kind === 'input';
}

export interface InputKindOptions {
  height?: number;
}

export function createInputKind<TId extends ItemId = ItemId>(
  options: InputKindOptions = {}
): AnyRowKindDefinition<MenuItemDefinition<TId>, TId> {
  return createJSXKind<MenuItemDefinition<TId>, TId, MenuInputDescriptor>({
    kind: 'input',
    height: options.height ?? MENU_EXTENDED_ITEM_HEIGHT,
    computeDescriptor(item, id, runtime) {
      const value = isInputItem(item) ? (item.draft ?? item.value ?? '') : '';
      const placeholder = isInputItem(item) ? resolveMenuLabel(item.placeholder, '') : '';
      const inputType = isInputItem(item) ? (item.inputType ?? 'text') : 'text';

      return {
        label: resolveMenuLabel(item.label, String(id)),
        icon: resolveMenuIcon(item.icon),
        value,
        placeholder,
        inputType,
        isDisabled: runtime.isDisabled,
        className: buildMenuKindClassName('menu-kind--input', runtime),
      };
    },
    Component: MenuInputRow,
  });
}




