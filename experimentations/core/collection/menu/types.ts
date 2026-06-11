import type { I18nText } from '@/core/culture';
import type { ItemId } from '@/core/collection/shared/runtime';

export type MenuInputType = 'text' | 'number' | 'date';

export type MenuLabel = I18nText | string;

export interface MenuDefinitionOptions {
  hoverOpenDelayMs?: number;
  inputApplyDebounceMs?: number;
}

interface MenuItemBase<TId extends ItemId = ItemId> {
  id: TId;
  kind: MenuItemKind;
  label?: MenuLabel;
  visible?: boolean;
  disabled?: boolean;
  icon?: string | null;
  submenu?: MenuDefinition<TId>;
}

export interface MenuActionItemDefinition<TId extends ItemId = ItemId> extends MenuItemBase<TId> {
  kind: 'action';
  actionId: string;
}

export interface MenuCheckboxItemDefinition<TId extends ItemId = ItemId> extends MenuItemBase<TId> {
  kind: 'checkbox';
}

export interface MenuInputItemDefinition<TId extends ItemId = ItemId> extends MenuItemBase<TId> {
  kind: 'input';
  value?: string;
  draft?: string;
  placeholder?: MenuLabel;
  inputType?: MenuInputType;
  debounceMs?: number;
}

export interface MenuEnumItemDefinition<TId extends ItemId = ItemId> extends MenuItemBase<TId> {
  kind: 'enum';
  values: string[];
  selectedValues?: string[];
}

export interface MenuSeparatorItemDefinition<TId extends ItemId = ItemId> extends MenuItemBase<TId> {
  kind: 'separator';
}

export type MenuItemKind = 'action' | 'checkbox' | 'input' | 'enum' | 'separator';

export type MenuItemDefinition<TId extends ItemId = ItemId> =
  | MenuActionItemDefinition<TId>
  | MenuCheckboxItemDefinition<TId>
  | MenuInputItemDefinition<TId>
  | MenuEnumItemDefinition<TId>
  | MenuSeparatorItemDefinition<TId>;

export interface MenuDefinition<TId extends ItemId = ItemId> {
  key: string;
  header?: string;
  items: Array<MenuItemDefinition<TId>>;
  options?: MenuDefinitionOptions;
}




