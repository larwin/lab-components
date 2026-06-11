import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { Culture } from '@/core/culture';
import { indexAt, type VirtualLayoutState } from '@/core/collection/virtual';
import type { ItemId, ItemRuntime } from '@/core/collection/shared/runtime';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state';
import { OVERSCAN_DEFAULT } from '@/core/collection/virtual';
import { repaintPool } from './pool.repaint';
import type { PoolCallbacks, PooledItem } from './PoolRenderer';
import { useVirtualPoolLifecycle } from './hooks/useVirtualPoolLifecycle';

const SPACER_STYLE = { minWidth: '100%', width: '100%' } as const;
const POOL_CONTAINER_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  minWidth: '100%',
  width: '100%',
  willChange: 'transform',
} as const;

export interface VirtualPoolProps<TItem, TId extends ItemId = ItemId> {
  items: TItem[];
  getItemId: (item: TItem) => TId;
  derived: CollectionDerivedState<TId, ItemRuntime>;
  listState: CollectionState<TId>;
  layoutState: VirtualLayoutState;
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>;
  fallbackItemHeight: number;
  poolItemHeight: number;
  poolStructureKey: string;
  height: number;
  overscan?: number;
  rowTone?: 'default' | 'zebra';
  context?: 'list' | 'grid' | 'menu';
  culture?: Culture;
  callbacks?: PoolCallbacks;
  onScroll?: (scrollTop: number) => void;
  containerRef?: MutableRefObject<HTMLDivElement | null>;
  isLoading?: boolean;
  emptyContent?: ReactNode;
  loadingContent?: ReactNode;
  className?: string;
  scrollClassName?: string;
  a11yPrefix?: string;
  manageHover?: boolean;
}

export function VirtualPool<TItem, TId extends ItemId = ItemId>({
  items,
  getItemId,
  derived,
  listState,
  layoutState,
  kindMap,
  fallbackItemHeight,
  poolItemHeight,
  poolStructureKey,
  height,
  overscan = OVERSCAN_DEFAULT,
  rowTone = 'default',
  context = 'list',
  culture,
  callbacks,
  onScroll,
  containerRef,
  isLoading = false,
  emptyContent = 'No items',
  loadingContent = 'Loading...',
  className = 'overflow-auto relative',
  scrollClassName = '',
  a11yPrefix,
  manageHover = false,
}: VirtualPoolProps<TItem, TId>) {
  const [containerHeight, setContainerHeight] = useState(height);
  const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);

  const spacerRef = useRef<HTMLDivElement | null>(null);
  const poolContainerRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<PooledItem[] | null>(null);
  const rafRef = useRef<number | null>(null);
  const repaintInProgressRef = useRef(false);
  const repaintNeededRef = useRef(false);
  const jsxPortalsRef = useRef<Array<{ key: string; el: HTMLElement; jsx: ReactNode }>>([]);
  const [, setJsxPortalVersion] = useState(0);

  const scrollTopRef = useRef(0);
  const containerHeightRef = useRef(height);
  const pointerOffsetYRef = useRef<number | null>(null);
  const hoveredItemIdRef = useRef<TId | null>(null);

  const derivedRef = useRef(derived);
  derivedRef.current = derived;

  const listStateRef = useRef(listState);
  listStateRef.current = listState;

  const layoutStateRef = useRef(layoutState);
  layoutStateRef.current = layoutState;

  const kindMapRef = useRef(kindMap);
  kindMapRef.current = kindMap;

  const cultureRef = useRef(culture);
  cultureRef.current = culture;

  const itemsById = useMemo(() => {
    const map = new Map<TId, TItem>();
    for (const item of items) {
      map.set(getItemId(item), item);
    }
    return map;
  }, [items, getItemId]);

  const itemsByIdRef = useRef(itemsById);
  itemsByIdRef.current = itemsById;

  const poolLifecycleKey = useMemo(
    () => `${poolStructureKey}:${containerHeight}`,
    [poolStructureKey, containerHeight]
  );

  const updateItems = useCallback(() => {
    if (!poolRef.current || !spacerRef.current || !poolContainerRef.current) {
      return;
    }

    if (repaintInProgressRef.current) {
      repaintNeededRef.current = true;
      return;
    }

    repaintInProgressRef.current = true;

    do {
      repaintNeededRef.current = false;

      if (!poolRef.current || !spacerRef.current || !poolContainerRef.current) {
        break;
      }

      repaintPool({
        pool: poolRef.current,
        spacerEl: spacerRef.current,
        poolContainerEl: poolContainerRef.current,
        derived: derivedRef.current,
        listState: listStateRef.current,
        layoutState: layoutStateRef.current,
        fallbackItemHeight,
        scrollTop: scrollTopRef.current,
        containerHeight: containerHeightRef.current,
        overscan,
        rowTone,
        context,
        kindMap: kindMapRef.current,
        itemsById: itemsByIdRef.current,
        runtimeById: derivedRef.current.runtimeById,
        culture: cultureRef.current,
        hoveredItemId: manageHover ? hoveredItemIdRef.current : null,
      });
    } while (repaintNeededRef.current);

    const currentPool = poolRef.current;
    if (currentPool) {
      const newPortals: Array<{ key: string; el: HTMLElement; jsx: ReactNode }> = [];
      currentPool.forEach((pooled, index) => {
        if (pooled.jsxRenderer && pooled.pendingJsx != null) {
          newPortals.push({ key: `jsx-${index}`, el: pooled.jsxRenderer.hostEl, jsx: pooled.pendingJsx });
        }
      });
      const prev = jsxPortalsRef.current;
      const changed =
        prev.length !== newPortals.length
        || newPortals.some((portal, index) => prev[index]?.jsx !== portal.jsx || prev[index]?.el !== portal.el);
      if (changed) {
        jsxPortalsRef.current = newPortals;
        setJsxPortalVersion((version) => version + 1);
      }
    }

    repaintInProgressRef.current = false;
  }, [fallbackItemHeight, overscan, rowTone, context, manageHover]);

  const resolveHoveredItemId = useCallback((scrollTop: number): TId | null => {
    if (!manageHover) {
      return null;
    }

    const pointerOffsetY = pointerOffsetYRef.current;
    if (pointerOffsetY == null) {
      return null;
    }

    const clampedOffsetY = Math.max(0, Math.min(pointerOffsetY, Math.max(0, containerHeightRef.current - 1)));
    const hoveredVisibleIndex = indexAt(layoutStateRef.current, scrollTop + clampedOffsetY);
    return derivedRef.current.visibleItemIds[hoveredVisibleIndex] ?? null;
  }, [manageHover]);

  const syncHoveredItem = useCallback((scrollTop: number, repaintNow: boolean) => {
    const nextHoveredItemId = resolveHoveredItemId(scrollTop);
    if (hoveredItemIdRef.current === nextHoveredItemId) {
      return;
    }

    hoveredItemIdRef.current = nextHoveredItemId;
    if (repaintNow) {
      updateItems();
    }
  }, [resolveHoveredItemId, updateItems]);

  useVirtualPoolLifecycle({
    containerRef: poolContainerRef,
    poolRef,
    containerHeightRef,
    poolItemHeight,
    poolStructureKey: poolLifecycleKey,
    kindMapRef,
    updateItems,
    overscan,
    callbacks,
  });

  useLayoutEffect(() => {
    updateItems();
  }, [updateItems, derived, listState, layoutState, itemsById, containerHeight]);

  useEffect(() => {
    if (!manageHover || !scrollContainerEl) {
      return;
    }

    const setHoveredItem = (nextHoveredItemId: TId | null) => {
      if (hoveredItemIdRef.current === nextHoveredItemId) {
        return;
      }
      hoveredItemIdRef.current = nextHoveredItemId;
      updateItems();
    };

    const updateHoveredFromEvent = (event: MouseEvent) => {
      const rect = scrollContainerEl.getBoundingClientRect();
      pointerOffsetYRef.current = event.clientY - rect.top;
      setHoveredItem(resolveHoveredItemId(scrollTopRef.current));
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateHoveredFromEvent(event);
    };

    const handleMouseOver = (event: MouseEvent) => {
      updateHoveredFromEvent(event);
    };

    const handleMouseLeave = () => {
      pointerOffsetYRef.current = null;
      if (hoveredItemIdRef.current == null) {
        return;
      }
      hoveredItemIdRef.current = null;
      updateItems();
    };

    scrollContainerEl.addEventListener('mousemove', handleMouseMove);
    scrollContainerEl.addEventListener('mouseover', handleMouseOver);
    scrollContainerEl.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      scrollContainerEl.removeEventListener('mousemove', handleMouseMove);
      scrollContainerEl.removeEventListener('mouseover', handleMouseOver);
      scrollContainerEl.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [scrollContainerEl, manageHover, resolveHoveredItemId, updateItems]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    scrollTopRef.current = nextScrollTop;
    if (manageHover) {
      syncHoveredItem(nextScrollTop, false);
    }
    onScroll?.(nextScrollTop);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushSync(() => updateItems());
    });
  }, [onScroll, updateItems, manageHover, syncHoveredItem]);

  const updateMeasuredHeight = useCallback((node: HTMLDivElement) => {
    const measuredHeight = node.clientHeight;
    if (measuredHeight <= 0) {
      return;
    }
    if (containerHeightRef.current === measuredHeight) {
      return;
    }
    containerHeightRef.current = measuredHeight;
    setContainerHeight(measuredHeight);
  }, []);

  const scrollAndMeasureRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainerEl(node);
    if (containerRef) {
      containerRef.current = node;
    }
    if (node) {
      updateMeasuredHeight(node);
    }
  }, [containerRef, updateMeasuredHeight]);

  useEffect(() => {
    if (!scrollContainerEl) {
      return;
    }

    updateMeasuredHeight(scrollContainerEl);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateMeasuredHeight(scrollContainerEl);
    });
    resizeObserver.observe(scrollContainerEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scrollContainerEl, updateMeasuredHeight]);

  useEffect(() => () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return (
    <>
      <div
        ref={scrollAndMeasureRef}
        onScroll={handleScroll}
        data-testid="virtual-pool-scroll"
        className={[className, scrollClassName].filter(Boolean).join(' ')}
        style={{ height: `${height}px` }}
      >
        <div ref={spacerRef} style={SPACER_STYLE} data-testid="virtual-pool-spacer" />
        <div
          ref={poolContainerRef}
          style={POOL_CONTAINER_STYLE}
          data-testid="virtual-pool-container"
          data-a11y-prefix={a11yPrefix}
        />

        {!isLoading && derived.visibleItemIds.length === 0 && (
          <div
            data-testid="virtual-pool-empty"
            className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          >
            {emptyContent}
          </div>
        )}

        {isLoading && (
          <div
            data-testid="virtual-pool-loading"
            className="absolute inset-0 grid place-items-center bg-card/80 text-sm font-medium"
          >
            {loadingContent}
          </div>
        )}
      </div>

      {jsxPortalsRef.current.map((portal) => createPortal(portal.jsx, portal.el, portal.key))}
    </>
  );
}




