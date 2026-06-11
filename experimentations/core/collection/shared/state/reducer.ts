import type { CollectionCapabilities } from '../definition/types';
import type { CollectionEffect } from '../effects/types';
import type { CollectionIntent, CollectionIntentModifiers } from '../intents/types';
import type { ItemId } from '../runtime';
import { DEFAULT_SELECTION_MODE } from '../selection';
import type { SelectionMode } from '../selection';
import { getFirstFocusableId, getLastFocusableId, getNextFocusableId, getPrevFocusableId } from '../keyboard';
import type { ItemRuntime, CollectionState } from './types';

const PAGE_STEP = 10;

export interface CollectionReduceContext<TId extends ItemId> {
  visibleItemIds: TId[];
  visibleItemIdSet?: ReadonlySet<TId>;
  visibleIndexById?: ReadonlyMap<TId, number>;
  isFocusable: (id: TId) => boolean;
  capabilities?: CollectionCapabilities;
  getItemRuntime?: (id: TId) => Pick<ItemRuntime, 'isExpandable' | 'isExpanded' | 'hierarchy'> | undefined;
}

export interface CollectionReduceResult<TId extends ItemId> {
  state: CollectionState<TId>;
  effects: CollectionEffect<TId>[];
}

function isKnownVisibleItem<TId extends ItemId>(visibleItemIdSet: ReadonlySet<TId>, itemId: TId): boolean {
  return visibleItemIdSet.has(itemId);
}

function createFocusEffects<TId extends ItemId>(itemId: TId): CollectionEffect<TId>[] {
  return [
    { type: 'FOCUS_DOM_ITEM', itemId },
    { type: 'SCROLL_TO_ITEM', itemId, align: 'auto' },
  ];
}

function withFocusedItem<TId extends ItemId>(state: CollectionState<TId>, itemId: TId | null): CollectionState<TId> {
  if (state.focusedItemId === itemId) {
    return state;
  }

  return {
    ...state,
    focusedItemId: itemId,
  };
}

function emitSelectionChange<TId extends ItemId>(selectedItemIds: Set<TId>): CollectionEffect<TId>[] {
  return [{ type: 'EMIT_SELECTION_CHANGE', selectedItemIds: new Set(selectedItemIds) }];
}

function toggleInSet<TId extends ItemId>(source: Set<TId>, id: TId): Set<TId> {
  const next = new Set(source);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function rangeSelection<TId extends ItemId>(
  ids: TId[],
  visibleIndexById: ReadonlyMap<TId, number>,
  fromId: TId,
  toId: TId
): Set<TId> | null {
  const fromIndex = visibleIndexById.get(fromId) ?? -1;
  const toIndex = visibleIndexById.get(toId) ?? -1;

  if (fromIndex === -1 || toIndex === -1) {
    return null;
  }

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return new Set(ids.slice(start, end + 1));
}

function getSelectionMode<TId extends ItemId>(context: CollectionReduceContext<TId>): SelectionMode {
  return context.capabilities?.selection ?? DEFAULT_SELECTION_MODE;
}

function canSelect<TId extends ItemId>(context: CollectionReduceContext<TId>): boolean {
  return getSelectionMode(context) !== 'none';
}

function canCheck<TId extends ItemId>(context: CollectionReduceContext<TId>): boolean {
  return context.capabilities?.check ?? true;
}

function canExpand<TId extends ItemId>(context: CollectionReduceContext<TId>): boolean {
  return context.capabilities?.expand ?? true;
}

function mapKeyDownIntent<TId extends ItemId>(
  key: string,
  modifiers: CollectionIntentModifiers,
  selectionMode: SelectionMode
): CollectionIntent<TId> | null {
  if ((modifiers.ctrl || modifiers.meta) && key.toLowerCase() === 'a' && selectionMode === 'multi') {
    return { type: 'SELECT_ALL' };
  }

  switch (key) {
    case 'ArrowDown':
      return { type: 'FOCUS_NEXT' };
    case 'ArrowUp':
      return { type: 'FOCUS_PREV' };
    case 'Home':
      return { type: 'FOCUS_FIRST' };
    case 'End':
      return { type: 'FOCUS_LAST' };
    case 'PageUp':
      return { type: 'FOCUS_PAGE_UP' };
    case 'PageDown':
      return { type: 'FOCUS_PAGE_DOWN' };
    case 'Enter':
      return { type: 'ACTIVATE_ITEM', source: 'keyboard' };
    case 'Escape':
      return { type: 'CLOSE' };
    case ' ':
      return { type: 'TOGGLE_CHECKBOX_ITEM' };
    default:
      return null;
  }
}

function movePage<TId extends ItemId>(
  current: TId | null,
  context: CollectionReduceContext<TId>,
  direction: 'up' | 'down'
): TId | null {
  if (context.visibleItemIds.length === 0) {
    return null;
  }

  let next = current;
  for (let index = 0; index < PAGE_STEP; index++) {
    next = direction === 'down'
      ? getNextFocusableId(context.visibleItemIds, next, context.isFocusable)
      : getPrevFocusableId(context.visibleItemIds, next, context.isFocusable);

    if (next == null) {
      return null;
    }
  }

  return next;
}

export function reduceCollection<TId extends ItemId>(
  state: CollectionState<TId>,
  intent: CollectionIntent<TId>,
  context: CollectionReduceContext<TId>
): CollectionReduceResult<TId> {
  const visibleItemIds = context.visibleItemIds;
  const visibleItemIdSet = context.visibleItemIdSet
    ?? new Set(visibleItemIds);
  const visibleIndexById = context.visibleIndexById
    ?? new Map(visibleItemIds.map((id, index) => [id, index] as const));

  switch (intent.type) {
    case 'OPEN': {
      return { state, effects: [] };
    }

    case 'CLOSE': {
      return { state, effects: [{ type: 'EMIT_CLOSE' }] };
    }

    case 'FOCUS_ITEM': {
      if (intent.itemId == null) {
        return { state: withFocusedItem(state, null), effects: [] };
      }

      if (!isKnownVisibleItem(visibleItemIdSet, intent.itemId) || !context.isFocusable(intent.itemId)) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, intent.itemId),
        effects: createFocusEffects(intent.itemId),
      };
    }

    case 'FOCUS_NEXT': {
      const itemId = getNextFocusableId(visibleItemIds, state.focusedItemId, context.isFocusable);
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'FOCUS_PREV': {
      const itemId = getPrevFocusableId(visibleItemIds, state.focusedItemId, context.isFocusable);
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'FOCUS_FIRST': {
      const itemId = getFirstFocusableId(visibleItemIds, context.isFocusable);
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'FOCUS_LAST': {
      const itemId = getLastFocusableId(visibleItemIds, context.isFocusable);
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'FOCUS_PAGE_UP': {
      const itemId = movePage(state.focusedItemId, context, 'up');
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'FOCUS_PAGE_DOWN': {
      const itemId = movePage(state.focusedItemId, context, 'down');
      if (itemId == null) {
        return { state, effects: [] };
      }

      return {
        state: withFocusedItem(state, itemId),
        effects: createFocusEffects(itemId),
      };
    }

    case 'CLICK_ITEM': {
      if (!isKnownVisibleItem(visibleItemIdSet, intent.itemId) || !context.isFocusable(intent.itemId)) {
        return { state, effects: [] };
      }

      const selectionMode = getSelectionMode(context);
      if (selectionMode === 'none') {
        return {
          state: withFocusedItem(state, intent.itemId),
          effects: createFocusEffects(intent.itemId),
        };
      }

      let nextSelected: Set<TId>;
      if (selectionMode === 'multi' && intent.modifiers.shift && state.focusedItemId != null) {
        const range = rangeSelection(visibleItemIds, visibleIndexById, state.focusedItemId, intent.itemId);
        nextSelected = range ?? new Set(state.selectedItemIds);
      } else if (selectionMode === 'multi' && (intent.modifiers.ctrl || intent.modifiers.meta)) {
        nextSelected = toggleInSet(state.selectedItemIds, intent.itemId);
      } else {
        nextSelected = new Set([intent.itemId]);
      }

      const nextState = {
        ...withFocusedItem(state, intent.itemId),
        selectedItemIds: nextSelected,
      };

      return {
        state: nextState,
        effects: [...createFocusEffects(intent.itemId), ...emitSelectionChange(nextSelected)],
      };
    }

    case 'TOGGLE_SELECT_ITEM': {
      if (!canSelect(context)) {
        return { state, effects: [] };
      }

      if (!isKnownVisibleItem(visibleItemIdSet, intent.itemId)) {
        return { state, effects: [] };
      }

      const selectionMode = getSelectionMode(context);
      const nextSelected = selectionMode === 'single'
        ? (state.selectedItemIds.has(intent.itemId) ? new Set<TId>() : new Set<TId>([intent.itemId]))
        : toggleInSet(state.selectedItemIds, intent.itemId);
      return {
        state: {
          ...state,
          selectedItemIds: nextSelected,
        },
        effects: emitSelectionChange(nextSelected),
      };
    }

    case 'SELECT_RANGE': {
      if (!canSelect(context)) {
        return { state, effects: [] };
      }

      if (getSelectionMode(context) === 'single') {
        if (!isKnownVisibleItem(visibleItemIdSet, intent.toId)) {
          return { state, effects: [] };
        }
        const nextSelected = new Set<TId>([intent.toId]);
        return {
          state: {
            ...state,
            selectedItemIds: nextSelected,
          },
          effects: emitSelectionChange(nextSelected),
        };
      }

      const range = rangeSelection(visibleItemIds, visibleIndexById, intent.fromId, intent.toId);
      if (!range) {
        return { state, effects: [] };
      }

      return {
        state: {
          ...state,
          selectedItemIds: range,
        },
        effects: emitSelectionChange(range),
      };
    }

    case 'SELECT_ALL': {
      if (getSelectionMode(context) !== 'multi') {
        return { state, effects: [] };
      }

      const nextSelected = new Set(visibleItemIds.filter((id) => context.isFocusable(id)));
      return {
        state: {
          ...state,
          selectedItemIds: nextSelected,
        },
        effects: emitSelectionChange(nextSelected),
      };
    }

    case 'CLEAR_SELECTION': {
      if (state.selectedItemIds.size === 0) {
        return { state, effects: [] };
      }

      const nextSelected = new Set<TId>();
      return {
        state: {
          ...state,
          selectedItemIds: nextSelected,
        },
        effects: emitSelectionChange(nextSelected),
      };
    }

    case 'TOGGLE_EXPAND_ITEM': {
      if (!canExpand(context)) {
        return { state, effects: [] };
      }

      if (!isKnownVisibleItem(visibleItemIdSet, intent.itemId)) {
        return { state, effects: [] };
      }

      return {
        state: {
          ...state,
          expandedItemIds: toggleInSet(state.expandedItemIds, intent.itemId),
        },
        effects: [],
      };
    }

    case 'TOGGLE_CHECKBOX_ITEM': {
      if (!canCheck(context)) {
        return { state, effects: [] };
      }

      const itemId = intent.itemId ?? state.focusedItemId;
      if (itemId == null || !isKnownVisibleItem(visibleItemIdSet, itemId)) {
        return { state, effects: [] };
      }

      return {
        state: {
          ...state,
          checkedItemIds: toggleInSet(state.checkedItemIds, itemId),
        },
        effects: [],
      };
    }

    case 'ACTIVATE_ITEM': {
      const itemId = intent.itemId ?? state.focusedItemId;
      if (itemId == null || !isKnownVisibleItem(visibleItemIdSet, itemId)) {
        return { state, effects: [] };
      }

      return {
        state,
        effects: [{ type: 'EMIT_ACTIVATE', itemId }],
      };
    }

    case 'KEY_DOWN': {
      const focusedItemId = state.focusedItemId;
      const focusedRuntime = focusedItemId != null ? context.getItemRuntime?.(focusedItemId) : undefined;

      if (intent.key === ' ' && focusedItemId != null && focusedRuntime?.isExpandable && canExpand(context)) {
        return reduceCollection(state, { type: 'TOGGLE_EXPAND_ITEM', itemId: focusedItemId }, context);
      }

      if (intent.key === 'ArrowRight') {
        if (!canExpand(context)) {
          return { state, effects: [] };
        }

        if (focusedItemId == null || focusedRuntime == null) {
          return { state, effects: [] };
        }

        if (!focusedRuntime.isExpandable) {
          return { state, effects: [] };
        }

        if (!focusedRuntime.isExpanded) {
          const nextExpanded = new Set(state.expandedItemIds);
          nextExpanded.add(focusedItemId);
          return {
            state: {
              ...state,
              expandedItemIds: nextExpanded,
            },
            effects: [],
          };
        }

        const focusedIndex = visibleIndexById.get(focusedItemId) ?? -1;
        if (focusedIndex < 0) {
          return { state, effects: [] };
        }

        const nextItemId = visibleItemIds[focusedIndex + 1];
        if (nextItemId == null || !context.isFocusable(nextItemId)) {
          return { state, effects: [] };
        }

        const nextRuntime = context.getItemRuntime?.(nextItemId);
        if (nextRuntime?.hierarchy.parentId !== focusedItemId) {
          return { state, effects: [] };
        }

        return {
          state: withFocusedItem(state, nextItemId),
          effects: createFocusEffects(nextItemId),
        };
      }

      if (intent.key === 'ArrowLeft') {
        if (!canExpand(context)) {
          return { state, effects: [] };
        }

        if (focusedItemId == null || focusedRuntime == null) {
          return { state, effects: [] };
        }

        if (focusedRuntime.isExpandable && focusedRuntime.isExpanded) {
          const nextExpanded = new Set(state.expandedItemIds);
          nextExpanded.delete(focusedItemId);
          return {
            state: {
              ...state,
              expandedItemIds: nextExpanded,
            },
            effects: [],
          };
        }

        const parentIdRaw = focusedRuntime.hierarchy.parentId;
        const parentId = parentIdRaw == null ? null : (parentIdRaw as TId);
        if (parentId == null || !isKnownVisibleItem(visibleItemIdSet, parentId)) {
          return { state, effects: [] };
        }

        if (focusedRuntime.isExpandable && !focusedRuntime.isExpanded) {
          if (!context.isFocusable(parentId)) {
            return { state, effects: [] };
          }

          return {
            state: withFocusedItem(state, parentId),
            effects: createFocusEffects(parentId),
          };
        }

        const nextExpanded = new Set(state.expandedItemIds);
        nextExpanded.delete(parentId);

        if (!context.isFocusable(parentId)) {
          return {
            state: {
              ...state,
              expandedItemIds: nextExpanded,
            },
            effects: [],
          };
        }

        return {
          state: {
            ...withFocusedItem(state, parentId),
            expandedItemIds: nextExpanded,
          },
          effects: createFocusEffects(parentId),
        };
      }

      const mapped = mapKeyDownIntent<TId>(intent.key, intent.modifiers, getSelectionMode(context));
      if (!mapped) {
        return { state, effects: [] };
      }

      return reduceCollection(state, mapped, context);
    }

    default:
      return { state, effects: [] };
  }
}



