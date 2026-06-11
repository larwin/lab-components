import type { CollectionIntent } from '../intents/types';
import type { ItemId } from '../runtime';

export type CollectionEffect<TId extends ItemId = ItemId> =
  | { type: 'FOCUS_DOM_ITEM'; itemId: TId }
  | { type: 'SCROLL_TO_ITEM'; itemId: TId; align: 'auto' | 'start' | 'end' }
  | { type: 'SCHEDULE_INTENT'; key: string; intent: CollectionIntent<TId>; delayMs: number }
  | { type: 'CANCEL_SCHEDULE'; key: string }
  | { type: 'EMIT_ACTIVATE'; itemId: TId }
  | { type: 'EMIT_SELECTION_CHANGE'; selectedItemIds: Set<TId> }
  | { type: 'EMIT_CLOSE' };
