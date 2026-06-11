import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import { OVERSCAN_DEFAULT } from '@/core/collection/virtual';
import { createItemPool, destroyItemPool, type PoolCallbacks, type PooledItem } from '../PoolRenderer';
import { computePoolSize } from '../pool.invalidation';

interface UseVirtualPoolLifecycleOptions<TItem, TId extends ItemId> {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  poolRef: MutableRefObject<PooledItem[] | null>;
  containerHeightRef: MutableRefObject<number>;
  poolItemHeight: number;
  poolStructureKey: string;
  kindMapRef: MutableRefObject<Record<string, AnyRowKindDefinition<TItem, TId>>>;
  updateItems: () => void;
  callbacks?: PoolCallbacks;
  overscan?: number;
}

export function useVirtualPoolLifecycle<TItem, TId extends ItemId>({
  containerRef,
  poolRef,
  containerHeightRef,
  poolItemHeight,
  poolStructureKey,
  kindMapRef,
  updateItems,
  callbacks,
  overscan = OVERSCAN_DEFAULT,
}: UseVirtualPoolLifecycleOptions<TItem, TId>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const poolSize = computePoolSize(containerHeightRef.current, poolItemHeight, overscan);
    poolRef.current = createItemPool(
      container,
      poolSize,
      kindMapRef.current,
      callbacks
    );

    updateItems();

    return () => {
      if (poolRef.current) {
        destroyItemPool(poolRef.current);
        poolRef.current = null;
      }
      container.innerHTML = '';
    };
  }, [
    containerRef,
    poolRef,
    containerHeightRef,
    poolItemHeight,
    poolStructureKey,
    kindMapRef,
    updateItems,
    callbacks,
    overscan,
  ]);
}



