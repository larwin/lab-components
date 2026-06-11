import type { ItemId } from '../runtime';

export interface CollectionIntentModifiers {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export type CollectionIntent<TId extends ItemId = ItemId> =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'FOCUS_ITEM'; itemId: TId | null }
  | { type: 'FOCUS_NEXT' }
  | { type: 'FOCUS_PREV' }
  | { type: 'FOCUS_FIRST' }
  | { type: 'FOCUS_LAST' }
  | { type: 'FOCUS_PAGE_UP' }
  | { type: 'FOCUS_PAGE_DOWN' }
  | { type: 'CLICK_ITEM'; itemId: TId; modifiers: CollectionIntentModifiers }
  | { type: 'ACTIVATE_ITEM'; itemId?: TId; source: 'mouse' | 'keyboard' }
  | { type: 'TOGGLE_SELECT_ITEM'; itemId: TId }
  | { type: 'SELECT_RANGE'; fromId: TId; toId: TId }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_EXPAND_ITEM'; itemId: TId }
  | { type: 'TOGGLE_CHECKBOX_ITEM'; itemId?: TId }
  | { type: 'KEY_DOWN'; key: string; modifiers: CollectionIntentModifiers };
