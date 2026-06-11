import { useEffect, useReducer, useRef, useState } from 'react';
import type { MenuDefinition } from '@/core/collection/menu/types';
import type { MenuIntent } from '@/core/collection/menu/intents/types';
import type { MenuEffect } from '@/core/collection/menu/effects/types';
import {
  createClosedMenuState,
  reduceMenu,
  type MenuLevelEntry,
  type MenuState,
} from '@/core/collection/menu/orchestrator';
import type { ItemId } from '@/core/collection/shared/runtime';
import { createMenuEffectRunner } from './effectRunner';
import type { MenuPoint } from './positioning';

interface UseMenuControllerOptions<TId extends ItemId> {
  onColumnFilterChange?: (itemId: TId, value: string | string[] | null) => void;
  onExecute?: (itemId: TId, actionId: string) => void;
}

interface ControllerInternalState<TId extends ItemId> {
  menuState: MenuState<TId>;
  effectRevision: number;
}

export interface MenuController<TId extends ItemId> {
  state: MenuState<TId>;
  openPosition: MenuPoint | null;
  activeLevelId: string | null;
  activeLevel: MenuLevelEntry<TId> | null;
  dispatch: (intent: MenuIntent<TId>) => void;
  runEffects: (effects: Array<MenuEffect<TId>>) => void;
  openMenu: (definition: MenuDefinition<TId>, position?: MenuPoint | null) => void;
  closeMenu: () => void;
}

export function useMenuController<TId extends ItemId = string>(
  options: UseMenuControllerOptions<TId> = {}
): MenuController<TId> {
  const pendingEffectsRef = useRef<Array<MenuEffect<TId>>>([]);
  const closeMenuRef = useRef<() => void>(() => {});
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const [internalState, dispatchState] = useReducer(
    (current: ControllerInternalState<TId>, intent: MenuIntent<TId>) => {
      const result = reduceMenu(current.menuState, intent);
      pendingEffectsRef.current = result.effects;
      const shouldBump = result.effects.length > 0 || result.state !== current.menuState;
      return {
        menuState: result.state,
        effectRevision: shouldBump ? current.effectRevision + 1 : current.effectRevision,
      };
    },
    undefined,
    () => ({
      menuState: createClosedMenuState<TId>(),
      effectRevision: 0,
    })
  );
  const [openPosition, setOpenPosition] = useState<MenuPoint | null>(null);

  const dispatch = (intent: MenuIntent<TId>) => {
    dispatchState(intent);
  };

  const effectRunnerRef = useRef(createMenuEffectRunner<TId>({
    dispatch: (intent) => {
      dispatchState(intent);
    },
    closeMenu: () => {
      closeMenuRef.current();
    },
    onColumnFilterChange: (itemId, value) => {
      callbacksRef.current.onColumnFilterChange?.(itemId, value);
    },
    onExecute: (itemId, actionId) => {
      callbacksRef.current.onExecute?.(itemId, actionId);
    },
  }));

  const runEffects = (effects: Array<MenuEffect<TId>>) => {
    effectRunnerRef.current.run(effects);
  };

  const closeMenu = () => {
    effectRunnerRef.current.cancelAll();
    setOpenPosition(null);
    dispatchState({ type: 'CLOSE_MENU' });
  };
  closeMenuRef.current = closeMenu;

  const openMenu = (definition: MenuDefinition<TId>, position?: MenuPoint | null) => {
    setOpenPosition(position ?? null);
    dispatchState({
      type: 'OPEN_MENU',
      definition,
    });
  };

  useEffect(() => {
    const effects = pendingEffectsRef.current;
    if (effects.length === 0) {
      return;
    }

    pendingEffectsRef.current = [];
    effectRunnerRef.current.run(effects);
  }, [internalState.effectRevision]);

  useEffect(() => () => {
    effectRunnerRef.current.cancelAll();
  }, []);

  useEffect(() => {
    if (internalState.menuState.levels.length === 0) {
      setOpenPosition(null);
    }
  }, [internalState.menuState.levels.length]);

  const state = internalState.menuState;
  const activeLevel = state.levels[state.levels.length - 1] ?? null;

  return {
    state,
    openPosition,
    activeLevelId: activeLevel?.id ?? null,
    activeLevel,
    dispatch,
    runEffects,
    openMenu,
    closeMenu,
  };
}





