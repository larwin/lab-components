import type { MenuEffect } from '@/core/collection/menu/effects/types';
import type { MenuIntent } from '@/core/collection/menu/intents/types';
import type { ItemId } from '@/core/collection/shared/runtime';

export interface MenuEffectRunnerCallbacks<TId extends ItemId> {
  dispatch: (intent: MenuIntent<TId>) => void;
  closeMenu: () => void;
  onColumnFilterChange?: (itemId: TId, value: string | string[] | null) => void;
  onExecute?: (itemId: TId, actionId: string) => void;
}

export interface MenuEffectRunner<TId extends ItemId> {
  run: (effects: Array<MenuEffect<TId>>) => void;
  cancelAll: () => void;
}

export function createMenuEffectRunner<TId extends ItemId>(
  callbacks: MenuEffectRunnerCallbacks<TId>
): MenuEffectRunner<TId> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const cancel = (key: string) => {
    const timer = timers.get(key);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    timers.delete(key);
  };

  const cancelAll = () => {
    for (const key of timers.keys()) {
      cancel(key);
    }
  };

  return {
    run(effects) {
      for (const effect of effects) {
        switch (effect.type) {
          case 'CANCEL_SCHEDULE':
            cancel(effect.key);
            break;

          case 'SCHEDULE_INTENT': {
            cancel(effect.key);
            const timeout = setTimeout(() => {
              timers.delete(effect.key);
              callbacks.dispatch(effect.intent);
            }, effect.delayMs);
            timers.set(effect.key, timeout);
            break;
          }

          case 'EMIT_COLUMN_FILTER_CHANGE':
            callbacks.onColumnFilterChange?.(effect.itemId, effect.value);
            break;

          case 'EMIT_EXECUTE':
            callbacks.onExecute?.(effect.itemId, effect.actionId);
            break;

          case 'EMIT_CLOSE':
            callbacks.closeMenu();
            break;

          default:
            break;
        }
      }
    },
    cancelAll,
  };
}





