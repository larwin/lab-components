import type { CollectionIntent } from '@/core/collection/shared/intents';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { MenuDefinition } from '../types';

export type MenuIntent<TId extends ItemId = ItemId> =
  | CollectionIntent<TId>
  | { type: 'OPEN_MENU'; definition: MenuDefinition<TId> }
  | { type: 'CLOSE_MENU' }
  | { type: 'ESCAPE'; levelId: string }
  | { type: 'OPEN_SUBMENU'; levelId: string; itemId: TId }
  | { type: 'CLOSE_SUBMENU'; levelId: string }
  | { type: 'CLOSE_CASCADE'; levelId: string }
  | { type: 'DRAFT_INPUT_ITEM'; itemId: TId; draft: string; debounceMs?: number }
  | { type: 'APPLY_INPUT_ITEM'; itemId: TId; origin: 'debounce' | 'enter' | 'blur' }
  | { type: 'TOGGLE_ENUM_VALUE'; itemId: TId; value: string }
  | { type: 'EXECUTE_MENU_ITEM'; itemId: TId; source: 'mouse' | 'keyboard' };



