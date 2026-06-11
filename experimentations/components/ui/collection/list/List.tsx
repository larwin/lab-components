import type { ReactElement, RefAttributes } from 'react';
import type { ItemId } from '@/core/collection/shared/runtime';
import {
  CollectionViewport,
  type CollectionViewportContext,
  type CollectionViewportHandle,
  type CollectionViewportProps,
  type CollectionViewportRowTone,
  resolvePoolItemHeight,
} from '@/components/ui/collection/shared/components';

export { resolvePoolItemHeight };

export type ListProps<TItem, TId extends ItemId = ItemId> = CollectionViewportProps<TItem, TId>;
export type ListHandle = CollectionViewportHandle;
export type ListContext = CollectionViewportContext;
export type ListRowTone = CollectionViewportRowTone;

export const List = CollectionViewport as <
  TItem,
  TId extends ItemId = ItemId,
>(
  props: ListProps<TItem, TId> & RefAttributes<ListHandle>
) => ReactElement;
