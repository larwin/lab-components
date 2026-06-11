import type { HierarchyRuntime } from '@/core/collection/shared/hierarchy';

export type ItemId = string | number;

export type PrimitiveValue = string | number | boolean | null | undefined;

export interface ItemRuntime {
  kind: string;
  isFocused: boolean;
  isSelected: boolean;
  isChecked: boolean;
  isDisabled: boolean;
  isExpanded: boolean;
  isExpandable: boolean;
  // Runtime entries only exist for visible rows in the current projection.
  // `isVisible` therefore means "present in derived.visibleItemIds".
  isVisible: boolean;
  hierarchy: HierarchyRuntime;
}
