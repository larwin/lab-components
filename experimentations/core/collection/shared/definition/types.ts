import type { Culture } from '@/core/culture';
import type { HierarchyDefinition } from '@/core/collection/shared/hierarchy';
import type { AnyRowKindDefinition } from '../kind';
import type { ItemId } from '../runtime';
import type { SelectionMode } from '../selection';

export interface CollectionCapabilities {
  selection?: SelectionMode;
  check?: boolean;
  expand?: boolean;
}

export interface CollectionDefinition<TItem, TId extends ItemId = string> {
  getItemId: (item: TItem) => TId;
  getItemKind?: (item: TItem, culture?: Culture) => string;
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>;
  hierarchy?: HierarchyDefinition<TItem, TId>;
  capabilities?: CollectionCapabilities;
  culture?: Culture;
}

export interface CollectionConfig<TItem, TId extends ItemId = string> extends CollectionDefinition<TItem, TId> {
  defaultKind: string;
}

export type { AnyRowKindDefinition } from '../kind';
