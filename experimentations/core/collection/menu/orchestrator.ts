import { createInitialCollectionState } from '@/core/collection/shared/state/initial';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { ItemId } from '@/core/collection/shared/runtime';
import { getVisibleMenuItems } from './adapter';
import type { MenuEffect } from './effects/types';
import type { MenuIntent } from './intents/types';
import {
  reduceMenuLevel,
  type MenuLevelState,
  type MenuReduceContext,
  type MenuReduceResult,
} from './reducer';
import type { MenuDefinition, MenuItemDefinition } from './types';

export interface MenuLevelEntry<TId extends ItemId> {
  id: string;
  menu: MenuDefinition<TId>;
  parentLevelId: string | null;
  parentItemId: TId | null;
  state: MenuLevelState<TId>;
}

export interface MenuState<TId extends ItemId> {
  rootMenu: MenuDefinition<TId> | null;
  levels: Array<MenuLevelEntry<TId>>;
}

export interface MenuOrchestratorResult<TId extends ItemId> {
  state: MenuState<TId>;
  effects: Array<MenuEffect<TId>>;
}

function createLevelId(index: number): string {
  return `level-${index}`;
}

function isFocusableMenuItem<TId extends ItemId>(item: MenuItemDefinition<TId>): boolean {
  return item.kind !== 'separator' && item.disabled !== true;
}

function getFirstFocusableItemId<TId extends ItemId>(menu: MenuDefinition<TId>): TId | null {
  const visibleItems = getVisibleMenuItems(menu);
  const first = visibleItems.find((item) => isFocusableMenuItem(item));
  return first?.id ?? null;
}

function createLevelState<TId extends ItemId>(menu: MenuDefinition<TId>): MenuLevelState<TId> {
  return {
    listState: {
      ...createInitialCollectionState<TId>(),
      focusedItemId: getFirstFocusableItemId(menu),
    },
    runtimeById: new Map(),
  };
}

function getLevelIndex<TId extends ItemId>(state: MenuState<TId>, levelId: string): number {
  return state.levels.findIndex((level) => level.id === levelId);
}

function buildLevelReduceContext<TId extends ItemId>(level: MenuLevelEntry<TId>): MenuReduceContext<TId> {
  const visibleItems = getVisibleMenuItems(level.menu);
  const visibleItemIds = visibleItems.map((item) => item.id);
  const itemById = new Map(level.menu.items.map((item) => [item.id, item]));

  return {
    visibleItemIds,
    visibleItemIdSet: new Set(visibleItemIds),
    visibleIndexById: new Map(visibleItemIds.map((id, index) => [id, index] as const)),
    isFocusable: (id) => {
      const item = itemById.get(id);
      return !!item && isFocusableMenuItem(item);
    },
    getItemRuntime: () => undefined as Pick<ItemRuntime, 'isExpandable' | 'isExpanded' | 'hierarchy'> | undefined,
    itemById,
    inputApplyDebounceMs: level.menu.options?.inputApplyDebounceMs,
  };
}

function withUpdatedLevel<TId extends ItemId>(
  state: MenuState<TId>,
  levelIndex: number,
  nextLevel: MenuLevelEntry<TId>
): MenuState<TId> {
  const levels = [...state.levels];
  levels[levelIndex] = nextLevel;
  return {
    ...state,
    levels,
  };
}

function resolveActiveLevelIndex<TId extends ItemId>(state: MenuState<TId>): number {
  return state.levels.length - 1;
}

function closeSubmenuLevel<TId extends ItemId>(state: MenuState<TId>, levelId: string): MenuState<TId> {
  const levelIndex = getLevelIndex(state, levelId);
  if (levelIndex <= 0) {
    return state;
  }

  const closingLevel = state.levels[levelIndex];
  if (!closingLevel) {
    return state;
  }

  const parentLevelIndex = levelIndex - 1;
  const parentLevel = state.levels[parentLevelIndex];
  if (!parentLevel) {
    return state;
  }

  const parentLevelState: MenuLevelEntry<TId> = {
    ...parentLevel,
    state: {
      ...parentLevel.state,
      listState: {
        ...parentLevel.state.listState,
        focusedItemId: closingLevel.parentItemId,
      },
    },
  };

  return {
    ...state,
    levels: [...state.levels.slice(0, parentLevelIndex), parentLevelState],
  };
}

function openSubmenuLevel<TId extends ItemId>(
  state: MenuState<TId>,
  levelId: string,
  itemId: TId
): MenuState<TId> {
  const levelIndex = getLevelIndex(state, levelId);
  if (levelIndex < 0) {
    return state;
  }

  const level = state.levels[levelIndex];
  const item = level?.menu.items.find((entry) => entry.id === itemId);
  if (!level || !item?.submenu) {
    return state;
  }

  const parentLevel: MenuLevelEntry<TId> = {
    ...level,
    state: {
      ...level.state,
      listState: {
        ...level.state.listState,
        focusedItemId: itemId,
      },
    },
  };

  const baseLevels = [...state.levels.slice(0, levelIndex), parentLevel];
  const nextLevel: MenuLevelEntry<TId> = {
    id: createLevelId(baseLevels.length),
    menu: item.submenu,
    parentLevelId: level.id,
    parentItemId: itemId,
    state: createLevelState(item.submenu),
  };

  return {
    ...state,
    levels: [...baseLevels, nextLevel],
  };
}

function reduceOnActiveLevel<TId extends ItemId>(
  state: MenuState<TId>,
  intent: MenuIntent<TId>
): MenuOrchestratorResult<TId> {
  const activeIndex = resolveActiveLevelIndex(state);
  const activeLevel = state.levels[activeIndex];
  if (!activeLevel) {
    return { state, effects: [] };
  }

  const context = buildLevelReduceContext(activeLevel);
  const reduced: MenuReduceResult<TId> = reduceMenuLevel(activeLevel.state, intent, context);
  const nextLevel: MenuLevelEntry<TId> = {
    ...activeLevel,
    state: reduced.state,
  };

  return {
    state: withUpdatedLevel(state, activeIndex, nextLevel),
    effects: reduced.effects,
  };
}

export function createClosedMenuState<TId extends ItemId>(): MenuState<TId> {
  return {
    rootMenu: null,
    levels: [],
  };
}

export function reduceMenu<TId extends ItemId>(
  state: MenuState<TId>,
  intent: MenuIntent<TId>
): MenuOrchestratorResult<TId> {
  switch (intent.type) {
    case 'OPEN_MENU': {
      const rootLevel: MenuLevelEntry<TId> = {
        id: createLevelId(0),
        menu: intent.definition,
        parentLevelId: null,
        parentItemId: null,
        state: createLevelState(intent.definition),
      };

      return {
        state: {
          rootMenu: intent.definition,
          levels: [rootLevel],
        },
        effects: [],
      };
    }

    case 'CLOSE_MENU': {
      return {
        state: createClosedMenuState<TId>(),
        effects: [],
      };
    }

    case 'OPEN_SUBMENU': {
      return {
        state: openSubmenuLevel(state, intent.levelId, intent.itemId),
        effects: [],
      };
    }

    case 'CLOSE_SUBMENU': {
      return {
        state: closeSubmenuLevel(state, intent.levelId),
        effects: [],
      };
    }

    case 'CLOSE_CASCADE': {
      return {
        state: createClosedMenuState<TId>(),
        effects: [],
      };
    }

    case 'ESCAPE': {
      const levelIndex = getLevelIndex(state, intent.levelId);
      if (levelIndex > 0) {
        return {
          state: closeSubmenuLevel(state, intent.levelId),
          effects: [],
        };
      }

      return {
        state: createClosedMenuState<TId>(),
        effects: [],
      };
    }

    default:
      return reduceOnActiveLevel(state, intent);
  }
}



