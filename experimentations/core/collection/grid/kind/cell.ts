import type { Culture } from '@/core/culture';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

export interface CellDescriptor {
  columnId: string;
  value: unknown;
  displayValue: unknown;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface CellKindDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  columnId: string;
  isHierarchyColumn?: boolean;
  getValue: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => unknown;
  getDisplay?: (
    item: TItem,
    id: TId,
    runtime: TRuntime,
    value: unknown,
    culture?: Culture
  ) => unknown;
  getClassName?: (
    item: TItem,
    id: TId,
    runtime: TRuntime,
    value: unknown,
    displayValue: unknown,
    culture?: Culture
  ) => string | undefined;
  getStyle?: (
    item: TItem,
    id: TId,
    runtime: TRuntime,
    value: unknown,
    displayValue: unknown,
    culture?: Culture
  ) => Partial<CSSStyleDeclaration> | undefined;
}



