import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollectionCapabilities, CollectionConfig } from '@/core/collection/shared/definition/types';
import type { CollectionEffect } from '@/core/collection/shared/effects/types';
import type { CollectionIntent } from '@/core/collection/shared/intents/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import { DEFAULT_SELECTION_MODE } from '@/core/collection/shared/selection';
import { reduceCollection } from '@/core/collection/shared/state/reducer';
import type { CollectionState } from '@/core/collection/shared/state/types';
import { createInitialCollectionState } from '@/core/collection/shared/state/initial';
import type { Culture } from '@/core/culture';
import type { KeyboardOverrides } from '@/core/collection/list/keyboard/keyboard';
import type { ItemHeightPolicy } from '@/core/collection/virtual';
import { useCollectionModel, type CollectionModelCache, type CollectionUiModel } from './useCollectionModel';

interface UseCollectionControllerOptions<TItem, TId extends ItemId> {
  items: TItem[];
  definition: CollectionConfig<TItem, TId>;
  cache: CollectionModelCache<TId>;
  itemHeightPolicy?: ItemHeightPolicy;
  culture?: Culture;
  collectionState?: CollectionState<TId>;
  defaultCollectionState?: CollectionState<TId>;
  defaultListState?: CollectionState<TId>;
  initialCollectionState?: CollectionState<TId>;
  initialListState?: CollectionState<TId>;
  onLastIntent?: (intent: CollectionIntent<TId>) => void;
  onLastEffect?: (effect: CollectionEffect<TId>) => void;
  onFocusDomItem?: (itemId: TId) => void;
  onScrollToItem?: (itemId: TId, align: 'auto' | 'start' | 'end') => void;
  onActivateItem?: (itemId: TId) => void;
  onSelectionChange?: (selectedItemIds: Set<TId>) => void;
  onClose?: () => void;
  capabilities?: CollectionCapabilities;
  keyboardOverrides?: KeyboardOverrides;
}

export interface CollectionController<TId extends ItemId> {
  collectionState: CollectionState<TId>;
  listState: CollectionState<TId>;
  model: CollectionUiModel<TId>;
  dispatchIntent: (intent: CollectionIntent<TId>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

function isKeyboardHandled(
  event: React.KeyboardEvent,
  capabilities: CollectionCapabilities | undefined,
  keyboardOverrides?: KeyboardOverrides
): boolean {
  const selectAll = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';
  if (selectAll && (capabilities?.selection ?? DEFAULT_SELECTION_MODE) === 'multi') {
    return true;
  }

  if (keyboardOverrides?.[event.key]) {
    return true;
  }

  return [
    'ArrowDown',
    'ArrowUp',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Enter',
    'Escape',
    ' ',
  ].includes(event.key);
}

function mergeCapabilities(
  definitionCapabilities: CollectionCapabilities | undefined,
  overrideCapabilities: CollectionCapabilities | undefined
): CollectionCapabilities | undefined {
  if (!definitionCapabilities && !overrideCapabilities) {
    return undefined;
  }

  return {
    ...(definitionCapabilities ?? {}),
    ...(overrideCapabilities ?? {}),
  };
}

export function useCollectionController<TItem, TId extends ItemId>({
  items,
  definition,
  cache,
  itemHeightPolicy,
  culture,
  collectionState: controlledCollectionStateProp,
  defaultCollectionState,
  defaultListState,
  initialCollectionState,
  initialListState,
  onLastIntent,
  onLastEffect,
  onFocusDomItem,
  onScrollToItem,
  onActivateItem,
  onSelectionChange,
  onClose,
  capabilities,
  keyboardOverrides,
}: UseCollectionControllerOptions<TItem, TId>): CollectionController<TId> {
  const legacyControlledCollectionState = initialCollectionState ?? initialListState;
  const controlledCollectionState = controlledCollectionStateProp ?? legacyControlledCollectionState;
  const initialUncontrolledCollectionState = (
    defaultCollectionState
    ?? defaultListState
    ?? createInitialCollectionState<TId>()
  );

  const [collectionState, setCollectionState] = useState<CollectionState<TId>>(
    () => initialUncontrolledCollectionState
  );
  const effectiveCollectionState = controlledCollectionState ?? collectionState;
  const collectionStateRef = useRef(collectionState);
  collectionStateRef.current = effectiveCollectionState;

  const model = useCollectionModel({
    items,
    definition,
    collectionState: effectiveCollectionState,
    cache,
    itemHeightPolicy,
    culture,
  });

  const derivedRef = useRef(model.derived);
  derivedRef.current = model.derived;
  const capabilitiesRef = useRef(mergeCapabilities(definition.capabilities, capabilities));
  capabilitiesRef.current = mergeCapabilities(definition.capabilities, capabilities);

  const scheduledRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dispatchRef = useRef<(intent: CollectionIntent<TId>) => void>(() => {});

  const dispatchIntent = useCallback((intent: CollectionIntent<TId>) => {
    onLastIntent?.(intent);

    const currentDerived = derivedRef.current;
    const visibleItemIds = currentDerived.visibleItemIds;
    const visibleItemIdSet = new Set(visibleItemIds);
    const visibleIndexById = new Map(visibleItemIds.map((id, index) => [id, index] as const));
    const currentState = controlledCollectionState ?? collectionStateRef.current;
    const result = reduceCollection(currentState, intent, {
      visibleItemIds,
      visibleItemIdSet,
      visibleIndexById,
      isFocusable: (id) => {
        const runtime = currentDerived.runtimeById.get(id);
        return !!runtime && !runtime.isDisabled;
      },
      capabilities: capabilitiesRef.current,
      getItemRuntime: (id) => currentDerived.runtimeById.get(id),
    });

    for (const effect of result.effects) {
      onLastEffect?.(effect);

      switch (effect.type) {
        case 'FOCUS_DOM_ITEM':
          onFocusDomItem?.(effect.itemId);
          break;
        case 'SCROLL_TO_ITEM':
          onScrollToItem?.(effect.itemId, effect.align);
          break;
        case 'EMIT_ACTIVATE':
          onActivateItem?.(effect.itemId);
          break;
        case 'EMIT_SELECTION_CHANGE':
          onSelectionChange?.(effect.selectedItemIds);
          break;
        case 'EMIT_CLOSE':
          onClose?.();
          break;
        case 'SCHEDULE_INTENT': {
          const previous = scheduledRef.current.get(effect.key);
          if (previous) {
            clearTimeout(previous);
          }
          const timeout = setTimeout(() => {
            scheduledRef.current.delete(effect.key);
            dispatchRef.current(effect.intent as CollectionIntent<TId>);
          }, effect.delayMs);
          scheduledRef.current.set(effect.key, timeout);
          break;
        }
        case 'CANCEL_SCHEDULE': {
          const timeout = scheduledRef.current.get(effect.key);
          if (timeout) {
            clearTimeout(timeout);
            scheduledRef.current.delete(effect.key);
          }
          break;
        }
      }
    }

    collectionStateRef.current = result.state;
    if (controlledCollectionState == null) {
      setCollectionState(result.state);
    }
  }, [
    onLastIntent,
    onLastEffect,
    onFocusDomItem,
    onScrollToItem,
    onActivateItem,
    onSelectionChange,
    onClose,
    controlledCollectionState,
  ]);

  dispatchRef.current = dispatchIntent;

  useEffect(() => () => {
    for (const timeout of scheduledRef.current.values()) {
      clearTimeout(timeout);
    }
    scheduledRef.current.clear();
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    const isInputActive = (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) && target.closest('[data-visible-index]') !== null;

    if (isInputActive && !['Tab', 'Escape'].includes(event.key)) {
      return;
    }

    if (!isKeyboardHandled(event, capabilitiesRef.current, keyboardOverrides)) {
      return;
    }

    event.preventDefault();

    const overrideMapper = keyboardOverrides?.[event.key];
    if (overrideMapper) {
      const mapped = overrideMapper(event.nativeEvent as KeyboardEvent, capabilitiesRef.current);
      if (mapped) {
        dispatchIntent(mapped as CollectionIntent<TId>);
      }
      return;
    }

    dispatchIntent({
      type: 'KEY_DOWN',
      key: event.key,
      modifiers: {
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      },
    });
  }, [keyboardOverrides, dispatchIntent]);

  return {
    collectionState: effectiveCollectionState,
    listState: effectiveCollectionState,
    model,
    dispatchIntent,
    handleKeyDown,
  };
}
