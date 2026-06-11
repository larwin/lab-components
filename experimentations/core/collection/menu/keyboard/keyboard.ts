import type { ItemId } from '@/core/collection/shared/runtime';
import type { MenuIntent } from '../intents/types';
import type { MenuItemDefinition } from '../types';

export interface MenuKeyboardContext<TId extends ItemId = ItemId> {
  levelId: string;
  hasParentLevel: boolean;
  focusedItemId: TId | null;
  itemById: Map<TId, MenuItemDefinition<TId>>;
}

function canOpenSubmenu<TId extends ItemId>(item: MenuItemDefinition<TId> | undefined): item is MenuItemDefinition<TId> {
  return !!item && item.submenu != null && item.disabled !== true && item.visible !== false && item.kind !== 'separator';
}

export function openSubmenu<TId extends ItemId>(ctx: MenuKeyboardContext<TId>): MenuIntent<TId> | null {
  if (ctx.focusedItemId == null) {
    return null;
  }

  const focusedItem = ctx.itemById.get(ctx.focusedItemId);
  if (!canOpenSubmenu(focusedItem)) {
    return null;
  }

  return {
    type: 'OPEN_SUBMENU',
    levelId: ctx.levelId,
    itemId: ctx.focusedItemId,
  };
}

export function closeSubmenu<TId extends ItemId>(ctx: MenuKeyboardContext<TId>): MenuIntent<TId> | null {
  if (!ctx.hasParentLevel) {
    return null;
  }

  return {
    type: 'CLOSE_SUBMENU',
    levelId: ctx.levelId,
  };
}

export function closeCascade<TId extends ItemId>(ctx: MenuKeyboardContext<TId>): MenuIntent<TId> {
  return {
    type: 'CLOSE_CASCADE',
    levelId: ctx.levelId,
  };
}

export function resolveMenuKeyboardIntent<TId extends ItemId>(
  key: string,
  ctx: MenuKeyboardContext<TId>
): MenuIntent<TId> | null {
  switch (key) {
    case 'ArrowRight':
      return openSubmenu(ctx);
    case 'ArrowLeft':
      return closeSubmenu(ctx);
    case 'Escape':
      return closeCascade(ctx);
    default:
      return null;
  }
}


