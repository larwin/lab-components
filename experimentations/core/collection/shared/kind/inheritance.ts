import type { Culture } from '@/core/culture';
import type { ItemId, ItemRuntime } from '../runtime';
import type { AnyRowKindDefinition, ItemDescriptor } from './types';

function resolveKindDefinition<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  kind: string
): AnyRowKindDefinition<TItem, TId> {
  return kindMap[kind] ?? kindMap.default ?? kindMap.separator ?? Object.values(kindMap)[0];
}

function resolveKindChain<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  kind: string
): Array<AnyRowKindDefinition<TItem, TId>> {
  const leaf = resolveKindDefinition(kindMap, kind);
  const chain: Array<AnyRowKindDefinition<TItem, TId>> = [leaf];
  const visited = new Set<string>([leaf.kind]);
  let cursor = leaf;

  while (cursor.extends) {
    const baseKind = kindMap[cursor.extends];
    if (!baseKind) {
      throw new Error(`Kind "${cursor.kind}" extends unknown kind "${cursor.extends}"`);
    }
    if (visited.has(baseKind.kind)) {
      throw new Error(`Circular kind inheritance detected at "${baseKind.kind}"`);
    }
    visited.add(baseKind.kind);
    chain.unshift(baseKind);
    cursor = baseKind;
  }

  return chain;
}

export function computeDescriptorWithInheritance<TItem, TId extends ItemId, TRuntime extends ItemRuntime>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  kind: string,
  item: TItem,
  id: TId,
  runtime: TRuntime,
  culture?: Culture
): ItemDescriptor {
  const chain = resolveKindChain(kindMap, kind);
  const descriptorCache = new Map<number, ItemDescriptor>();

  const run = (index: number): ItemDescriptor => {
    const cached = descriptorCache.get(index);
    if (cached) {
      return cached;
    }

    const kindDef = chain[index];
    const base = index > 0 ? (() => run(index - 1)) : undefined;
    const descriptor = kindDef.computeDescriptor(
      item,
      id,
      runtime,
      culture,
      base as (() => never) | undefined
    ) as ItemDescriptor;
    descriptorCache.set(index, descriptor);
    return descriptor;
  };

  return run(chain.length - 1);
}

export function updateWithInheritance<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  kind: string,
  refs: unknown,
  descriptor: ItemDescriptor
): void {
  const chain = resolveKindChain(kindMap, kind);
  const updated = new Set<number>();

  const run = (index: number): void => {
    if (updated.has(index)) {
      return;
    }
    updated.add(index);

    const kindDef = chain[index];
    const base = index > 0 ? (() => run(index - 1)) : undefined;
    kindDef.update(
      refs as never,
      descriptor as never,
      base
    );
  };

  run(chain.length - 1);
}
