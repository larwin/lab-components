import type { ItemId } from '../runtime';
import type { CollectionCacheAdapter } from './types';

function encodeKey(itemId: string | number, kind: string, name: string): string {
  function encodePart(part: string | number): string {
    const typed = typeof part === 'number' ? `n:${part}` : `s:${part}`;
    return `${typed.length}:${typed}`;
  }
  return `${encodePart(itemId)}|${encodePart(kind)}|${encodePart(name)}`;
}

export class CollectionCache<TId extends ItemId> implements CollectionCacheAdapter<TId> {
  private readonly values = new Map<string, unknown>();

  hasValue(itemId: TId, kind: string, name: string): boolean {
    return this.values.has(encodeKey(itemId, kind, name));
  }

  getValue(itemId: TId, kind: string, name: string): unknown {
    return this.values.get(encodeKey(itemId, kind, name));
  }

  setValue(itemId: TId, kind: string, name: string, value: unknown): void {
    this.values.set(encodeKey(itemId, kind, name), value);
  }

  invalidateAll(): void {
    this.values.clear();
  }
}
