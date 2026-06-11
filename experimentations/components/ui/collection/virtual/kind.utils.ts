import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';

export function resolveKindDefinition<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  kind: string
): AnyRowKindDefinition<TItem, TId> {
  return kindMap[kind] ?? kindMap.default ?? kindMap.separator ?? Object.values(kindMap)[0];
}


