import { forwardRef, useRef } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';
import type { Culture } from '@/core/culture';
import { CollectionCache } from '@/core/collection/shared/cache';
import type { CollectionCapabilities, CollectionConfig } from '@/core/collection/shared/definition/types';
import type { CollectionEffect } from '@/core/collection/shared/effects/types';
import type { CollectionIntent } from '@/core/collection/shared/intents/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { CollectionState } from '@/core/collection/shared/state/types';
import type { KeyboardOverrides } from '@/core/collection/list/keyboard/keyboard';
import type { ItemHeightPolicy } from '@/core/collection/virtual';
import { useCollectionController } from '@/components/ui/collection/shared/hooks';
import { List } from '../List';
import type { ListContext, ListHandle, ListRowTone } from '../List';

interface TestControlledListProps<TItem, TId extends ItemId = ItemId> {
  items: TItem[];
  definition: CollectionConfig<TItem, TId>;
  isLoading?: boolean;
  height?: number;
  overscan?: number;
  context?: ListContext;
  rowTone?: ListRowTone;
  onCheckedChange?: (checkedIds: Set<TId>) => void;
  onSelectionChange?: (selectedIds: Set<TId>) => void;
  onLastIntent?: (intent: CollectionIntent<TId>) => void;
  onLastEffect?: (effect: CollectionEffect<TId>) => void;
  onActivate?: (itemId: TId) => void;
  onClose?: () => void;
  initialListState?: CollectionState<TId>;
  itemHeightPolicy?: ItemHeightPolicy;
  culture?: Culture;
  capabilities?: CollectionCapabilities;
  keyboardOverrides?: KeyboardOverrides;
}

function setForwardedRef<TValue>(
  ref: ForwardedRef<TValue>,
  value: TValue | null
) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref != null) {
    ref.current = value;
  }
}

function TestControlledListInner<TItem, TId extends ItemId = ItemId>({
  items,
  definition,
  isLoading,
  height,
  overscan,
  context,
  rowTone,
  onCheckedChange,
  onSelectionChange,
  onLastIntent,
  onLastEffect,
  onActivate,
  onClose,
  initialListState,
  itemHeightPolicy,
  culture,
  capabilities,
  keyboardOverrides,
}: TestControlledListProps<TItem, TId>, ref: ForwardedRef<ListHandle>) {
  const cacheRef = useRef(new CollectionCache<TId>());
  const listRef = useRef<ListHandle | null>(null);

  const controller = useCollectionController({
    items,
    definition,
    cache: cacheRef.current,
    itemHeightPolicy,
    culture,
    initialListState,
    onLastIntent,
    onLastEffect,
    onActivateItem: onActivate,
    onSelectionChange,
    onClose,
    capabilities,
    keyboardOverrides,
    onFocusDomItem: () => {
      listRef.current?.focus();
    },
    onScrollToItem: (itemId, align) => {
      listRef.current?.scrollToItem(itemId, align);
    },
  });

  return (
    <List
      ref={(handle) => {
        listRef.current = handle;
        setForwardedRef(ref, handle);
      }}
      definition={definition}
      listState={controller.collectionState}
      model={controller.model}
      dispatchIntent={controller.dispatchIntent}
      handleKeyDown={controller.handleKeyDown}
      isLoading={isLoading}
      height={height}
      overscan={overscan}
      context={context}
      rowTone={rowTone}
      onCheckedChange={onCheckedChange}
    />
  );
}

export const TestControlledList = forwardRef(TestControlledListInner) as <
  TItem,
  TId extends ItemId = ItemId,
>(
  props: TestControlledListProps<TItem, TId> & RefAttributes<ListHandle>
) => ReactElement;
