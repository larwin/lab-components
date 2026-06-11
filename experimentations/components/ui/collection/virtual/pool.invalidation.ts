import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemHeightPolicy } from '@/core/collection/virtual';
import type { ItemId } from '@/core/collection/shared/runtime';
import { DEFAULT_CONTAINER_HEIGHT } from './constants';

export function computePoolSize(containerHeight: number, poolItemHeight: number, overscan: number): number {
  return Math.ceil(Math.max(containerHeight, DEFAULT_CONTAINER_HEIGHT) / poolItemHeight) + overscan * 2 + 1;
}

export function buildItemHeightPolicyKey(policy: ItemHeightPolicy): string {
  if (policy.kind === 'fixed') {
    return `fixed:${policy.itemHeight}:${policy.poolItemHeight ?? ''}`;
  }

  return `byKind:${policy.defaultHeight}:${policy.poolItemHeight ?? ''}:${Object.entries(policy.heights)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, height]) => `${kind}:${height}`)
    .join('|')}`;
}

export function buildKindMapKey<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>
): string {
  return Object.entries(kindMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, kindDef]) => `${key}:${kindDef.kind}:${kindDef.height}`)
    .join('|');
}

export function buildPoolStructureKey<TItem, TId extends ItemId>(
  policy: ItemHeightPolicy,
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>
): string {
  return `${buildItemHeightPolicyKey(policy)}::${buildKindMapKey(kindMap)}`;
}

export function shouldRebuildPool(options: {
  previousStructureKey: string;
  nextStructureKey: string;
  previousPoolSize: number;
  nextPoolSize: number;
}): boolean {
  return (
    options.previousStructureKey !== options.nextStructureKey
    || options.previousPoolSize !== options.nextPoolSize
  );
}


