import type { ColumnCoreDef } from './column.core';
import type { ColumnAlign, ColumnPinned } from './column.view';
import type { Culture } from '@/core/culture';
import { i18n, type I18nText } from '@/core/culture';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { CellKindDefinition } from '../kind/cell';

export interface ColumnViewDef {
  id: string;
  header: I18nText;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  pinned?: ColumnPinned;
}

export interface ColumnDef<TItem, TId extends ItemId = ItemId> {
  id: string;
  kind: string;
  header: I18nText;
  core: ColumnCoreDef<TItem>;
  cell: CellKindDefinition<TItem, TId, ItemRuntime>;
  view: ColumnViewDef;
}

export interface DefineColumnOptions<TItem> {
  id: string;
  header: string | I18nText;
  kind?: string;
  getValue: (item: TItem, culture?: Culture) => unknown;
  getDisplay?: (item: TItem, value: unknown, culture?: Culture) => unknown;
  sortable?: boolean;
  filterable?: boolean;
  filterOperators?: string[];
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  pinned?: ColumnPinned;
}

function asI18nText(value: string | I18nText): I18nText {
  return typeof value === 'string' ? i18n.literal(value) : value;
}

function styleFromOptions(options: Pick<DefineColumnOptions<unknown>, 'width' | 'minWidth' | 'maxWidth' | 'align'>):
Partial<CSSStyleDeclaration> | undefined {
  const style: Partial<CSSStyleDeclaration> = {};

  if (options.width != null) {
    style.width = `${options.width}px`;
    style.flex = `0 0 ${options.width}px`;
  }

  if (options.minWidth != null) {
    style.minWidth = `${options.minWidth}px`;
  }

  if (options.maxWidth != null) {
    style.maxWidth = `${options.maxWidth}px`;
  }

  if (options.align === 'center') {
    style.justifyContent = 'center';
    style.textAlign = 'center';
  } else if (options.align === 'right') {
    style.justifyContent = 'flex-end';
    style.textAlign = 'right';
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

export function defineColumn<TItem, TId extends ItemId = ItemId>(
  options: DefineColumnOptions<TItem>
): ColumnDef<TItem, TId> {
  const header = asI18nText(options.header);
  const kind = options.kind ?? 'string';
  const staticStyle = styleFromOptions(options as DefineColumnOptions<unknown>);

  return {
    id: options.id,
    kind,
    header,
    core: {
      id: options.id,
      kind,
      getValue: (row, _columnId, culture) => options.getValue(row, culture),
      sortable: options.sortable,
      filterable: options.filterable,
      filterOperators: options.filterOperators,
    },
    cell: {
      columnId: options.id,
      isHierarchyColumn: kind === 'hierarchy',
      getValue: (item, _id, _runtime, culture) => options.getValue(item, culture),
      getDisplay: options.getDisplay
        ? (item, _id, _runtime, value, culture) => options.getDisplay?.(item, value, culture)
        : undefined,
      getStyle: staticStyle ? () => staticStyle : undefined,
    },
    view: {
      id: options.id,
      header,
      width: options.width,
      minWidth: options.minWidth,
      maxWidth: options.maxWidth,
      align: options.align,
      pinned: options.pinned,
    },
  };
}




