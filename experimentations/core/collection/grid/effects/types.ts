import type { CollectionEffect } from '@/core/collection/shared/effects';
import type { ItemId } from '@/core/collection/shared/runtime';

export type GridEffect<TId extends ItemId = ItemId> =
  | CollectionEffect<TId>
  | { type: 'EMIT_ROW_ACTION'; itemId: TId; actionId: string };



