import type { CollectionEffect } from '@/core/collection/shared/effects';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { MenuIntent } from '../intents/types';

export type MenuEffect<TId extends ItemId = ItemId> =
  | Exclude<CollectionEffect<TId>, { type: 'SCHEDULE_INTENT' }>
  | { type: 'SCHEDULE_INTENT'; key: string; intent: MenuIntent<TId>; delayMs: number }
  | { type: 'EMIT_COLUMN_FILTER_CHANGE'; itemId: TId; value: string | string[] | null }
  | { type: 'EMIT_EXECUTE'; itemId: TId; actionId: string };



