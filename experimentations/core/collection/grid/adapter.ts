import { defineCollection, type CollectionConfig } from '@/core/collection/shared/definition';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import { toGridConfig, type GridConfig, type GridDefinition } from './definition/facade';

export function adaptGridToCollectionConfig<TItem, TId extends ItemId = string>(
  definition: GridDefinition<TItem, TId> | GridConfig<TItem, TId>,
  kindMap?: Record<string, AnyRowKindDefinition<TItem, TId>>
): CollectionConfig<TItem, TId> {
  const config = toGridConfig(definition);
  const effectiveKindMap = kindMap ?? config.kindMap;

  return defineCollection<TItem, TId>({
    getItemId: config.getRowId,
    getItemKind: config.getRowKind ? (item) => config.getRowKind?.(item) ?? config.defaultKind : undefined,
    kindMap: effectiveKindMap,
    hierarchy: config.hierarchy,
    culture: config.culture,
    capabilities: config.capabilities,
  });
}


