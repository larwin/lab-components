import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import { RowKindSeparatorDefinition } from '@/core/collection/shared/kind/separator';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import { MENU_EXTENDED_ITEM_HEIGHT, MENU_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import { createActionKind } from './ActionRowKind';
import { createCheckboxKind } from './CheckboxRowKind';
import { createInputKind } from './InputRowKind';
import { createEnumKind } from './EnumRowKind';

export interface MenuPresetKindOptions {
  actionHeight?: number;
  checkboxHeight?: number;
  inputHeight?: number;
  enumHeight?: number;
}

export function createMenuPresetKindMap<TId extends ItemId = ItemId>(
  options: MenuPresetKindOptions = {}
): Record<string, AnyRowKindDefinition<MenuItemDefinition<TId>, TId>> {
  return {
    action: createActionKind<TId>({ height: options.actionHeight ?? MENU_ITEM_HEIGHT }),
    checkbox: createCheckboxKind<TId>({ height: options.checkboxHeight ?? MENU_ITEM_HEIGHT }),
    input: createInputKind<TId>({ height: options.inputHeight ?? MENU_EXTENDED_ITEM_HEIGHT }),
    enum: createEnumKind<TId>({ height: options.enumHeight ?? MENU_EXTENDED_ITEM_HEIGHT }),
    separator: new RowKindSeparatorDefinition<MenuItemDefinition<TId>, TId>(),
  };
}

export { createActionKind } from './ActionRowKind';
export type { ActionKindOptions, ActionKindDescriptor, ActionKindDOMRefs } from './ActionRowKind';
export { createCheckboxKind } from './CheckboxRowKind';
export type { CheckboxKindOptions } from './CheckboxRowKind';
export { createInputKind } from './InputRowKind';
export type { InputKindOptions } from './InputRowKind';
export { createEnumKind } from './EnumRowKind';
export type { EnumKindOptions } from './EnumRowKind';




