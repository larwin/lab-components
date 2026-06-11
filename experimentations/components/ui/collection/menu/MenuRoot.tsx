import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { adaptMenuToCollectionConfig, getVisibleMenuItems } from '@/core/collection/menu/adapter';
import type { MenuEffect } from '@/core/collection/menu/effects/types';
import type { MenuIntent } from '@/core/collection/menu/intents/types';
import type { MenuLevelEntry } from '@/core/collection/menu/orchestrator';
import type {
  MenuDefinition,
  MenuEnumItemDefinition,
  MenuInputItemDefinition,
  MenuItemDefinition,
} from '@/core/collection/menu/types';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { CollectionConfig } from '@/core/collection/shared/definition';
import {
  MENU_HOVER_DELAY_MS,
  MENU_ITEM_HEIGHT,
  MENU_OVERSCAN_DEFAULT,
  MENU_Z_INDEX_BASE,
} from '@/core/collection/menu/constants';
import { CollectionCache } from '@/core/collection/shared/cache';
import type { CollectionEffect } from '@/core/collection/shared/effects/types';
import type { CollectionIntent } from '@/core/collection/shared/intents/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import {
  CollectionViewport,
  type CollectionViewportHandle,
} from '@/components/ui/collection/shared/components';
import { useCollectionController } from '@/components/ui/collection/shared/hooks';
import { getVisibleIndexFromEventTarget } from '@/components/ui/collection/virtual/eventTarget';
import {
  computeRootPlacement,
  computeSubmenuPlacement,
  MENU_POSITIONING_DEFAULTS,
  type RootPlacementResult,
} from './positioning';
import type { MenuController } from './useMenuController';
import { createMenuPresetKindMap } from './presets';
import type { MenuPresetKindOptions } from './presets';
import './menu.css';

interface LevelPlacement extends RootPlacementResult {}

export interface MenuRootProps<TId extends ItemId> {
  controller: MenuController<TId>;
  kindOptions?: MenuPresetKindOptions;
  maxVisibleRows?: number;
}

function getFallbackPlacement(): LevelPlacement {
  return {
    left: MENU_POSITIONING_DEFAULTS.safeMargin,
    top: MENU_POSITIONING_DEFAULTS.safeMargin,
    width: MENU_POSITIONING_DEFAULTS.fallbackSize.width,
    height: MENU_POSITIONING_DEFAULTS.fallbackSize.height,
    maxWidth: Math.max(0, window.innerWidth - MENU_POSITIONING_DEFAULTS.safeMargin * 2),
    maxHeight: Math.max(0, window.innerHeight - MENU_POSITIONING_DEFAULTS.safeMargin * 2),
    fitsHorizontally: true,
    fitsVertically: true,
    clampedX: false,
    clampedY: false,
  };
}

function mergeRuntimeItem<TId extends ItemId>(
  item: MenuItemDefinition<TId>,
  runtime: { checked?: boolean; draft?: string; inputValue?: string; enumSelectedValues?: string[] } | undefined
): MenuItemDefinition<TId> {
  if (!runtime) {
    return item;
  }

  if (item.kind === 'input') {
    const inputItem: MenuInputItemDefinition<TId> = {
      ...item,
      draft: runtime.draft ?? item.draft,
      value: runtime.inputValue ?? item.value,
    };
    return inputItem;
  }

  if (item.kind === 'enum') {
    const enumItem: MenuEnumItemDefinition<TId> = {
      ...item,
      selectedValues: runtime.enumSelectedValues ?? item.selectedValues,
    };
    return enumItem;
  }

  return item;
}

interface MenuLevelListProps<TId extends ItemId> {
  levelId: string;
  items: Array<MenuItemDefinition<TId>>;
  definition: CollectionConfig<MenuItemDefinition<TId>, TId>;
  listState: MenuLevelEntry<TId>['state']['listState'];
  height: number;
  registerHandle: (handle: CollectionViewportHandle | null) => void;
  onIntent: (intent: CollectionIntent<TId>) => void;
  onEffect?: (effect: CollectionEffect<TId>) => void;
}

function MenuLevelList<TId extends ItemId>({
  levelId: _levelId,
  items,
  definition,
  listState,
  height,
  registerHandle,
  onIntent,
  onEffect,
}: MenuLevelListProps<TId>) {
  const cacheRef = useRef(new CollectionCache<TId>());
  const listRef = useRef<CollectionViewportHandle | null>(null);

  const controller = useCollectionController({
    items,
    definition,
    cache: cacheRef.current,
    collectionState: listState,
    onLastIntent: onIntent,
    onLastEffect: onEffect,
    onFocusDomItem: () => {
      listRef.current?.focus();
    },
    onScrollToItem: (itemId, align) => {
      listRef.current?.scrollToItem(itemId, align);
    },
  });

  return (
    <CollectionViewport
      ref={(handle) => {
        listRef.current = handle;
        registerHandle(handle);
      }}
      definition={definition}
      listState={controller.collectionState}
      model={controller.model}
      dispatchIntent={controller.dispatchIntent}
      handleKeyDown={controller.handleKeyDown}
      height={height}
      overscan={MENU_OVERSCAN_DEFAULT}
      context="menu"
    />
  );
}

interface MenuLevelContainerProps<TId extends ItemId> {
  level: MenuLevelEntry<TId>;
  levelIndex: number;
  placement: LevelPlacement;
  visibleItems: Array<MenuItemDefinition<TId>>;
  listDefinition: CollectionConfig<MenuItemDefinition<TId>, TId>;
  listHeight: number;
  childLevelId: string | null;
  controller: MenuController<TId>;
  layerRefs: MutableRefObject<Map<string, HTMLDivElement | null>>;
  listHandleRefs: MutableRefObject<Map<string, CollectionViewportHandle | null>>;
  focusedByLevelIdRef: MutableRefObject<Map<string, TId>>;
  hoveredByLevelIdRef: MutableRefObject<Map<string, TId>>;
}

function MenuLevelContainer<TId extends ItemId>({
  level,
  levelIndex,
  placement,
  visibleItems,
  listDefinition,
  listHeight,
  childLevelId,
  controller,
  layerRefs,
  listHandleRefs,
  focusedByLevelIdRef,
  hoveredByLevelIdRef,
}: MenuLevelContainerProps<TId>) {
  const itemById = useMemo(
    () => new Map(visibleItems.map((item) => [item.id, item])),
    [visibleItems]
  );

  const openFocusedSubmenu = () => {
    const focused = focusedByLevelIdRef.current.get(level.id)
      ?? level.state.listState.focusedItemId
      ?? null;
    if (focused == null) {
      return;
    }
    const focusedItem = itemById.get(focused);
    if (!focusedItem?.submenu) {
      return;
    }
    controller.dispatch({
      type: 'OPEN_SUBMENU',
      levelId: level.id,
      itemId: focused,
    });
  };

  const resolveItemFromEventTarget = (eventTarget: EventTarget | null): MenuItemDefinition<TId> | null => {
    const visibleIndex = getVisibleIndexFromEventTarget(eventTarget);
    if (visibleIndex == null) {
      return null;
    }

    return visibleItems[visibleIndex] ?? null;
  };

  return (
    <div
      key={level.id}
      ref={(node) => {
        layerRefs.current.set(level.id, node);
      }}
      className="menu-layer"
      style={{
        position: 'fixed',
        left: `${placement.left}px`,
        top: `${placement.top}px`,
        zIndex: MENU_Z_INDEX_BASE + levelIndex,
        minWidth: '280px',
        maxWidth: `${placement.maxWidth}px`,
        maxHeight: `${placement.maxHeight}px`,
      }}
      data-testid={levelIndex === 0 ? 'menu-root-container' : `menu-level-layer-${level.id}`}
      onMouseOverCapture={(event) => {
        const item = resolveItemFromEventTarget(event.target);
        if (item == null) {
          return;
        }
        const itemId = item.id;

        if (hoveredByLevelIdRef.current.get(level.id) === itemId) {
          return;
        }
        hoveredByLevelIdRef.current.set(level.id, itemId);

        const hoverKey = `menu:hover:${level.id}`;
        const effects: Array<MenuEffect<TId>> = [
          { type: 'CANCEL_SCHEDULE', key: hoverKey },
        ];

        if (item.submenu) {
          effects.push({
            type: 'SCHEDULE_INTENT',
            key: hoverKey,
            delayMs: level.menu.options?.hoverOpenDelayMs ?? MENU_HOVER_DELAY_MS,
            intent: {
              type: 'OPEN_SUBMENU',
              levelId: level.id,
              itemId,
            },
          });
        } else if (childLevelId != null) {
          controller.dispatch({
            type: 'CLOSE_SUBMENU',
            levelId: childLevelId,
          });
        }

        controller.runEffects(effects);
      }}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
          return;
        }

        const enumValueEl = target.closest('[data-menu-enum-value]') as HTMLElement | null;
        if (enumValueEl) {
          const value = enumValueEl.dataset.menuEnumValue;
          const enumItem = resolveItemFromEventTarget(enumValueEl);
          if (value && enumItem != null) {
            controller.dispatch({
              type: 'TOGGLE_ENUM_VALUE',
              itemId: enumItem.id,
              value,
            });
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }

        const item = resolveItemFromEventTarget(target);
        if (!item || item.kind !== 'action') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (item.submenu) {
          controller.dispatch({
            type: 'OPEN_SUBMENU',
            levelId: level.id,
            itemId: item.id,
          });
        } else {
          controller.dispatch({
            type: 'EXECUTE_MENU_ITEM',
            itemId: item.id,
            source: 'mouse',
          });
        }
      }}
      onInputCapture={(event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target || target.dataset.menuInput !== 'true') {
          return;
        }
        const item = resolveItemFromEventTarget(target);
        if (!item || item.kind !== 'input') {
          return;
        }

        controller.dispatch({
          type: 'DRAFT_INPUT_ITEM',
          itemId: item.id,
          draft: target.value,
        });
        event.stopPropagation();
      }}
      onBlurCapture={(event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target || target.dataset.menuInput !== 'true') {
          return;
        }

        const item = resolveItemFromEventTarget(target);
        if (!item || item.kind !== 'input') {
          return;
        }

        controller.dispatch({
          type: 'APPLY_INPUT_ITEM',
          itemId: item.id,
          origin: 'blur',
        });
      }}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target || target.dataset.menuInput !== 'true') {
          return;
        }

        const item = resolveItemFromEventTarget(target);
        if (!item || item.kind !== 'input') {
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          controller.dispatch({
            type: 'APPLY_INPUT_ITEM',
            itemId: item.id,
            origin: 'enter',
          });
        }
      }}
    >
      {level.menu.header != null && (
        <div className="menu-header">
          {level.menu.header}
        </div>
      )}
      <MenuLevelList
        levelId={level.id}
        items={visibleItems}
        definition={listDefinition}
        listState={level.state.listState}
        height={listHeight}
        registerHandle={(handle) => {
          if (handle) {
            listHandleRefs.current.set(level.id, handle);
          } else {
            listHandleRefs.current.delete(level.id);
          }
        }}
        onIntent={(intent) => {
          if (intent.type === 'KEY_DOWN') {
            if (intent.key === 'ArrowRight') {
              openFocusedSubmenu();
              return;
            }

            if (intent.key === 'ArrowLeft') {
              if (levelIndex > 0) {
                controller.dispatch({
                  type: 'CLOSE_SUBMENU',
                  levelId: level.id,
                });
              }
              return;
            }

            if (intent.key === 'Escape') {
              controller.dispatch({
                type: 'ESCAPE',
                levelId: level.id,
              });
              return;
            }
          }

          if (intent.type === 'ACTIVATE_ITEM' && intent.source === 'keyboard') {
            const focused = level.state.listState.focusedItemId;
            if (focused == null) {
              return;
            }
            const item = itemById.get(focused);
            if (!item || item.kind !== 'action') {
              return;
            }
            if (item.submenu) {
              openFocusedSubmenu();
            } else {
              controller.dispatch({
                type: 'EXECUTE_MENU_ITEM',
                itemId: focused,
                source: 'keyboard',
              });
            }
            return;
          }

          controller.dispatch(intent as MenuIntent<TId>);
        }}
        onEffect={(effect) => {
          if (effect.type === 'FOCUS_DOM_ITEM') {
            focusedByLevelIdRef.current.set(level.id, effect.itemId as TId);
          }
        }}
      />
    </div>
  );
}

export function MenuRoot<TId extends ItemId>({ controller, kindOptions, maxVisibleRows }: MenuRootProps<TId>) {
  const [placementsByLevelId, setPlacementsByLevelId] = useState<Record<string, LevelPlacement>>({});
  const layerRefs = useRef(new Map<string, HTMLDivElement | null>());
  const listHandleRefs = useRef(new Map<string, CollectionViewportHandle | null>());
  const focusedByLevelIdRef = useRef(new Map<string, TId>());
  const hoveredByLevelIdRef = useRef(new Map<string, TId>());
  const definitionCacheRef = useRef(new Map<string, {
    menu: MenuDefinition<TId>;
    kindMapRef: Record<string, AnyRowKindDefinition<MenuItemDefinition<TId>, TId>>;
    definition: CollectionConfig<MenuItemDefinition<TId>, TId>;
  }>());
  const kindMap = useMemo(
    () => createMenuPresetKindMap<TId>(kindOptions),
    [kindOptions]
  );

  useLayoutEffect(() => {
    if (controller.state.levels.length === 0) {
      setPlacementsByLevelId({});
      return;
    }

    const safeMargin = MENU_POSITIONING_DEFAULTS.safeMargin;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const nextPlacements: Record<string, LevelPlacement> = {};
    const rootLevel = controller.state.levels[0];
    if (!rootLevel) {
      return;
    }

    const rootLayer = layerRefs.current.get(rootLevel.id);
    const rootRect = rootLayer?.getBoundingClientRect();
    const rootPlacement = computeRootPlacement({
      point: controller.openPosition ?? { x: safeMargin, y: safeMargin },
      menuSize: {
        width: rootRect?.width ?? MENU_POSITIONING_DEFAULTS.fallbackSize.width,
        height: rootRect?.height ?? MENU_POSITIONING_DEFAULTS.fallbackSize.height,
      },
      viewport,
      safeMargin,
    });
    nextPlacements[rootLevel.id] = rootPlacement;

    for (let index = 1; index < controller.state.levels.length; index += 1) {
      const level = controller.state.levels[index];
      if (!level) {
        continue;
      }

      const layer = layerRefs.current.get(level.id);
      const layerRect = layer?.getBoundingClientRect();
      const menuWidth = layerRect?.width ?? MENU_POSITIONING_DEFAULTS.fallbackSize.width;
      const menuHeight = layerRect?.height ?? MENU_POSITIONING_DEFAULTS.fallbackSize.height;
      const parentLevel = level.parentLevelId
        ? controller.state.levels.find((entry) => entry.id === level.parentLevelId)
        : null;
      const parentVisibleIndex = (
        parentLevel != null
        && level.parentItemId != null
      )
        ? getVisibleMenuItems(parentLevel.menu).findIndex((item) => item.id === level.parentItemId)
        : -1;
      const parentHandle = level.parentLevelId
        ? listHandleRefs.current.get(level.parentLevelId)
        : null;
      const parentItemRect = parentVisibleIndex >= 0
        ? (parentHandle?.getVisibleItemRect(parentVisibleIndex) ?? null)
        : null;

      if (parentItemRect) {
        nextPlacements[level.id] = computeSubmenuPlacement({
          parentItemRect,
          menuSize: { width: menuWidth, height: menuHeight },
          viewport,
          safeMargin,
          submenuGap: MENU_POSITIONING_DEFAULTS.submenuGap,
        });
      } else {
        nextPlacements[level.id] = computeRootPlacement({
          point: {
            x: rootPlacement.left + rootPlacement.width + MENU_POSITIONING_DEFAULTS.submenuGap,
            y: rootPlacement.top,
          },
          menuSize: { width: menuWidth, height: menuHeight },
          viewport,
          safeMargin,
        });
      }
    }

    setPlacementsByLevelId(nextPlacements);
  }, [controller.state.levels, controller.openPosition]);

  useEffect(() => {
    const levels = controller.state.levels;
    if (levels.length === 0) {
      return;
    }

    const activeLevel = levels[levels.length - 1];
    if (!activeLevel) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      listHandleRefs.current.get(activeLevel.id)?.focus();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller.state.levels.length]);

  useEffect(() => {
    if (controller.state.levels.length === 0) {
      return;
    }

    const closeOnResize = () => {
      controller.closeMenu();
    };

    window.addEventListener('resize', closeOnResize);
    return () => {
      window.removeEventListener('resize', closeOnResize);
    };
  }, [controller, controller.state.levels.length]);

  const visibleItemsByLevel = useMemo(() => new Map(
    controller.state.levels.map((level) => {
      const visibleItems = getVisibleMenuItems(level.menu).map((item) => {
        const runtime = level.state.runtimeById.get(item.id);
        return mergeRuntimeItem(item, runtime);
      });
      return [level.id, visibleItems];
    })
  ), [controller.state.levels]);

  const listDefinitionByLevel = useMemo(() => {
    const previousCache = definitionCacheRef.current;
    const nextCache = new Map<string, {
      menu: MenuDefinition<TId>;
      kindMapRef: Record<string, AnyRowKindDefinition<MenuItemDefinition<TId>, TId>>;
      definition: CollectionConfig<MenuItemDefinition<TId>, TId>;
    }>();
    const definitions = new Map<string, CollectionConfig<MenuItemDefinition<TId>, TId>>();

    for (const level of controller.state.levels) {
      const cached = previousCache.get(level.id);
      if (cached && cached.menu === level.menu && cached.kindMapRef === kindMap) {
        definitions.set(level.id, cached.definition);
        nextCache.set(level.id, cached);
        continue;
      }

      const definition = adaptMenuToCollectionConfig(level.menu, { kindMap });
      definitions.set(level.id, definition);
      nextCache.set(level.id, {
        menu: level.menu,
        kindMapRef: kindMap,
        definition,
      });
    }

    definitionCacheRef.current = nextCache;
    return definitions;
  }, [controller.state.levels, kindMap]);

  if (controller.state.levels.length === 0) {
    return null;
  }

  return (
    <div className="menu-root">
      <div
        className="menu-overlay"
        data-testid="menu-overlay"
        onMouseDown={() => {
          controller.closeMenu();
        }}
      />
      {controller.state.levels.map((level, index) => {
        const placement = placementsByLevelId[level.id] ?? getFallbackPlacement();
        const visibleItems = visibleItemsByLevel.get(level.id) ?? [];
        const listDefinition = listDefinitionByLevel.get(level.id)
          ?? adaptMenuToCollectionConfig(level.menu, { kindMap });
        const listHeight = Math.min(
          visibleItems.reduce((sum, item) => {
            const kindDef = listDefinition.kindMap[item.kind];
            return sum + (kindDef?.height ?? MENU_ITEM_HEIGHT);
          }, 0),
          maxVisibleRows != null && maxVisibleRows > 0
            ? visibleItems.slice(0, maxVisibleRows).reduce((sum, item) => {
              const kindDef = listDefinition.kindMap[item.kind];
              return sum + (kindDef?.height ?? MENU_ITEM_HEIGHT);
            }, 0)
            : Number.POSITIVE_INFINITY,
          placement.maxHeight
        );
        const childLevelId = controller.state.levels.find((entry) => entry.parentLevelId === level.id)?.id ?? null;

        return (
          <MenuLevelContainer
            key={level.id}
            level={level}
            levelIndex={index}
            placement={placement}
            visibleItems={visibleItems}
            listDefinition={listDefinition}
            listHeight={listHeight}
            childLevelId={childLevelId}
            controller={controller}
            layerRefs={layerRefs}
            listHandleRefs={listHandleRefs}
            focusedByLevelIdRef={focusedByLevelIdRef}
            hoveredByLevelIdRef={hoveredByLevelIdRef}
          />
        );
      })}
    </div>
  );
}




