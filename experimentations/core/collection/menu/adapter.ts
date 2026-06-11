import { defineCollection, type CollectionConfig } from '@/core/collection/shared/definition';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import { resolveI18nText } from '@/core/culture';
import { RowKindSeparatorDefinition } from '@/core/collection/shared/kind/separator';
import type { ItemId } from '@/core/collection/shared/runtime';
import { RowKindActionDefinition, RowKindCheckboxDefinition, RowKindEnumDefinition, RowKindInputDefinition } from './kind';
import type {
  MenuDefinition,
  MenuItemDefinition,
  MenuItemKind,
  MenuLabel,
} from './types';
import { MENU_EXTENDED_ITEM_HEIGHT, MENU_ITEM_HEIGHT } from './constants';

function resolveLabel(label: MenuLabel | undefined, fallback: string): string {
  if (label == null) {
    return fallback;
  }

  if (typeof label === 'string') {
    return label;
  }

  return resolveI18nText(label, undefined);
}

export interface MenuKindMapOptions {
  actionHeight?: number;
  checkboxHeight?: number;
  inputHeight?: number;
  enumHeight?: number;
}

export interface MenuAdapterOptions<TId extends ItemId = ItemId> {
  kindMap?: Record<string, AnyRowKindDefinition<MenuItemDefinition<TId>, TId>>;
  kindOptions?: MenuKindMapOptions;
}

function createBuiltInKindMap<TId extends ItemId = ItemId>(
  options?: MenuKindMapOptions
): Record<MenuItemKind, AnyRowKindDefinition<MenuItemDefinition<TId>, TId>> {
  return {
    action: new RowKindActionDefinition<MenuItemDefinition<TId>, TId>({
      height: options?.actionHeight ?? MENU_ITEM_HEIGHT,
      getLabel: (item) => resolveLabel(item.label, String(item.id)),
      getIcon: (item) => item.icon,
      hasSubmenu: (item) => Boolean(item.submenu),
    }),
    checkbox: new RowKindCheckboxDefinition<MenuItemDefinition<TId>, TId>({
      height: options?.checkboxHeight ?? MENU_ITEM_HEIGHT,
      getLabel: (item) => resolveLabel(item.label, String(item.id)),
    }),
    input: new RowKindInputDefinition<MenuItemDefinition<TId>, TId>({
      height: options?.inputHeight ?? MENU_EXTENDED_ITEM_HEIGHT,
      getLabel: (item) => resolveLabel(item.label, String(item.id)),
      getValue: (item) => (item.kind === 'input' ? item.draft ?? item.value ?? '' : ''),
      getPlaceholder: (item) => (item.kind === 'input' ? resolveLabel(item.placeholder, '') : ''),
      getInputType: (item) => (item.kind === 'input' ? item.inputType : 'text'),
    }),
    enum: new RowKindEnumDefinition<MenuItemDefinition<TId>, TId>({
      height: options?.enumHeight ?? MENU_EXTENDED_ITEM_HEIGHT,
      getLabel: (item) => resolveLabel(item.label, String(item.id)),
      getValues: (item) => (item.kind === 'enum' ? item.values : []),
      getSelectedValues: (item) => (
        item.kind === 'enum' ? item.selectedValues ?? [] : []
      ),
    }),
    separator: new RowKindSeparatorDefinition<MenuItemDefinition<TId>, TId>(),
  };
}

export function getVisibleMenuItems<TId extends ItemId>(
  definition: MenuDefinition<TId>
): Array<MenuItemDefinition<TId>> {
  return definition.items.filter((item) => item.visible !== false);
}

export function adaptMenuToCollectionConfig<TId extends ItemId = ItemId>(
  definition: MenuDefinition<TId>,
  options: MenuAdapterOptions<TId> = {}
): CollectionConfig<MenuItemDefinition<TId>, TId> {
  const builtInKinds = createBuiltInKindMap<TId>(options.kindOptions);
  const kindMap = {
    ...builtInKinds,
    ...(options.kindMap ?? {}),
  };

  return defineCollection<MenuItemDefinition<TId>, TId>({
    getItemId: (item) => item.id,
    getItemKind: (item) => item.kind,
    kindMap,
    capabilities: {
      selection: 'none',
      check: true,
      expand: false,
    },
  });
}



