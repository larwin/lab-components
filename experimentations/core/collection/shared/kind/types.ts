import type { Culture } from '@/core/culture';
import type { ItemId, ItemRuntime } from '../runtime';

/**
 * Core collection row kinds are browser-first and manipulate DOM nodes directly.
 * UI layers may wrap these kinds, but the rendering contract remains DOM-native.
 */
export type KindHostElement = HTMLElement;

export interface ItemDescriptor {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface RowKindDefinition<
  TItem,
  TId extends ItemId,
  TRuntime extends ItemRuntime,
  TDescriptor extends ItemDescriptor,
  TDOMRefs,
> {
  kind: string;
  height: number;
  extends?: string;

  computeDescriptor(
    item: TItem,
    id: TId,
    runtime: TRuntime,
    culture?: Culture,
    base?: () => TDescriptor,
  ): TDescriptor;

  create(container: KindHostElement): TDOMRefs;
  update(refs: TDOMRefs, descriptor: TDescriptor, base?: () => void): void;
}

export type AnyRowKindDefinition<TItem = unknown, TId extends ItemId = ItemId> = RowKindDefinition<
  TItem,
  TId,
  ItemRuntime,
  ItemDescriptor,
  unknown
>;
