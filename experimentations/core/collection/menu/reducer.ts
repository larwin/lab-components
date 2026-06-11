import type { CollectionReduceContext } from '@/core/collection/shared/state/reducer';
import { reduceCollection } from '@/core/collection/shared/state/reducer';
import type { CollectionState } from '@/core/collection/shared/state/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { MenuEffect } from './effects/types';
import type { MenuIntent } from './intents/types';
import type { MenuEnumItemDefinition, MenuInputItemDefinition, MenuItemDefinition } from './types';
import { MENU_INPUT_DEBOUNCE_MS } from './constants';

function inputScheduleKey(itemId: ItemId): string {
  return `menu:input:${String(itemId)}`;
}

export interface MenuItemRuntimeState {
  checked?: boolean;
  draft?: string;
  inputValue?: string;
  enumSelectedValues?: string[];
}

export interface MenuLevelState<TId extends ItemId> {
  listState: CollectionState<TId>;
  runtimeById: Map<TId, MenuItemRuntimeState>;
}

export interface MenuReduceContext<TId extends ItemId> extends CollectionReduceContext<TId> {
  itemById: Map<TId, MenuItemDefinition<TId>>;
  inputApplyDebounceMs?: number;
}

export interface MenuReduceResult<TId extends ItemId> {
  state: MenuLevelState<TId>;
  effects: Array<MenuEffect<TId>>;
}

function updateRuntime<TId extends ItemId>(
  runtimeById: Map<TId, MenuItemRuntimeState>,
  itemId: TId,
  patch: Partial<MenuItemRuntimeState>
): Map<TId, MenuItemRuntimeState> {
  const next = new Map(runtimeById);
  const current = next.get(itemId) ?? {};
  next.set(itemId, {
    ...current,
    ...patch,
  });
  return next;
}

function getInputDraft<TId extends ItemId>(
  state: MenuLevelState<TId>,
  item: MenuInputItemDefinition<TId>,
  itemId: TId
): string {
  const runtime = state.runtimeById.get(itemId);
  if (runtime?.draft != null) {
    return runtime.draft;
  }

  return item.draft ?? item.value ?? '';
}

function getEnumValues<TId extends ItemId>(
  state: MenuLevelState<TId>,
  item: MenuEnumItemDefinition<TId>,
  itemId: TId
): string[] {
  const runtime = state.runtimeById.get(itemId);
  if (runtime?.enumSelectedValues != null) {
    return runtime.enumSelectedValues;
  }

  return item.selectedValues ?? [];
}

function resolveToggledCheckboxId<TId extends ItemId>(
  intent: MenuIntent<TId>,
  listState: CollectionState<TId>
): TId | null {
  if (intent.type !== 'TOGGLE_CHECKBOX_ITEM') {
    return null;
  }

  return intent.itemId ?? listState.focusedItemId;
}

export function reduceMenuLevel<TId extends ItemId>(
  state: MenuLevelState<TId>,
  intent: MenuIntent<TId>,
  context: MenuReduceContext<TId>
): MenuReduceResult<TId> {
  switch (intent.type) {
    case 'DRAFT_INPUT_ITEM': {
      const item = context.itemById.get(intent.itemId);
      if (!item || item.kind !== 'input') {
        return { state, effects: [] };
      }

      const runtimeById = updateRuntime(state.runtimeById, intent.itemId, {
        draft: intent.draft,
      });
      const delayMs = intent.debounceMs ?? item.debounceMs ?? context.inputApplyDebounceMs ?? MENU_INPUT_DEBOUNCE_MS;

      return {
        state: {
          ...state,
          runtimeById,
        },
        effects: [
          {
            type: 'CANCEL_SCHEDULE',
            key: inputScheduleKey(intent.itemId),
          },
          {
            type: 'SCHEDULE_INTENT',
            key: inputScheduleKey(intent.itemId),
            delayMs,
            intent: {
              type: 'APPLY_INPUT_ITEM',
              itemId: intent.itemId,
              origin: 'debounce',
            },
          },
        ],
      };
    }

    case 'APPLY_INPUT_ITEM': {
      const item = context.itemById.get(intent.itemId);
      if (!item || item.kind !== 'input') {
        return { state, effects: [] };
      }

      const draft = getInputDraft(state, item, intent.itemId);
      const runtimeById = updateRuntime(state.runtimeById, intent.itemId, {
        draft,
        inputValue: draft,
      });

      return {
        state: {
          ...state,
          runtimeById,
        },
        effects: [
          {
            type: 'CANCEL_SCHEDULE',
            key: inputScheduleKey(intent.itemId),
          },
          {
            type: 'EMIT_COLUMN_FILTER_CHANGE',
            itemId: intent.itemId,
            value: draft.length > 0 ? draft : null,
          },
        ],
      };
    }

    case 'TOGGLE_ENUM_VALUE': {
      const item = context.itemById.get(intent.itemId);
      if (!item || item.kind !== 'enum') {
        return { state, effects: [] };
      }

      const current = getEnumValues(state, item, intent.itemId);
      const nextValues = current.includes(intent.value)
        ? current.filter((value) => value !== intent.value)
        : [...current, intent.value];
      const runtimeById = updateRuntime(state.runtimeById, intent.itemId, {
        enumSelectedValues: nextValues,
      });

      return {
        state: {
          ...state,
          runtimeById,
        },
        effects: [
          {
            type: 'EMIT_COLUMN_FILTER_CHANGE',
            itemId: intent.itemId,
            value: nextValues.length > 0 ? nextValues : null,
          },
        ],
      };
    }

    case 'EXECUTE_MENU_ITEM': {
      const item = context.itemById.get(intent.itemId);
      if (!item || item.kind !== 'action') {
        return { state, effects: [] };
      }

      return {
        state,
        effects: [
          {
            type: 'EMIT_EXECUTE',
            itemId: intent.itemId,
            actionId: item.actionId,
          },
        ],
      };
    }

    case 'OPEN_SUBMENU':
    case 'CLOSE_SUBMENU':
    case 'CLOSE_CASCADE':
    case 'OPEN_MENU':
    case 'CLOSE_MENU':
    case 'ESCAPE': {
      return { state, effects: [] };
    }

    default: {
      const listResult = reduceCollection(state.listState, intent, context);
      const toggledCheckboxId = resolveToggledCheckboxId(intent, listResult.state);
      let runtimeById = state.runtimeById;

      if (toggledCheckboxId != null) {
        const item = context.itemById.get(toggledCheckboxId);
        if (item?.kind === 'checkbox') {
          runtimeById = updateRuntime(runtimeById, toggledCheckboxId, {
            checked: listResult.state.checkedItemIds.has(toggledCheckboxId),
          });
        }
      }

      return {
        state: {
          ...state,
          listState: listResult.state,
          runtimeById,
        },
        effects: listResult.effects,
      };
    }
  }
}



