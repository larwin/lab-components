import type { ColumnCoreDef } from './column.core';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { CollectionCapabilities } from '@/core/collection/shared/definition';
import type { Culture } from '@/core/culture';
import type { HierarchyDefinition } from '@/core/collection/shared/hierarchy';
import type { ItemId } from '@/core/collection/shared/runtime';
import { RowKindCellularDefinition } from '../kind/cellular';
import type { CellKindDefinition } from '../kind/cell';
import type { ColumnDef, ColumnViewDef } from './column';
import { GRID_DEFAULT_ROW_HEIGHT } from '../constants';

export interface GridDefinition<TItem, TId extends ItemId = string> {
  columns: Array<ColumnDef<TItem, TId>>;
  getRowId: (row: TItem) => TId;
  getRowKind?: (row: TItem) => string;
  hierarchy?: HierarchyDefinition<TItem, TId>;
  capabilities?: CollectionCapabilities;
  culture?: Culture;
  rowHeight?: number;
  kindMap?: Record<string, AnyRowKindDefinition<TItem, TId>>;
}

export interface GridConfig<TItem, TId extends ItemId = string> extends GridDefinition<TItem, TId> {
  rowHeight: number;
  defaultKind: string;
  columnCoreDefs: Array<ColumnCoreDef<TItem>>;
  columnViewDefs: Array<ColumnViewDef>;
  cellKinds: Array<CellKindDefinition<TItem, TId>>;
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>;
}

export function toGridConfig<TItem, TId extends ItemId>(
  definition: GridDefinition<TItem, TId> | GridConfig<TItem, TId>
): GridConfig<TItem, TId> {
  if ('columnCoreDefs' in definition) {
    return definition;
  }

  return defineGrid(definition);
}

function normalizeKindMap<TItem, TId extends ItemId>(
  def: GridDefinition<TItem, TId>,
  cellKinds: Array<CellKindDefinition<TItem, TId>>,
  rowHeight: number
): Record<string, AnyRowKindDefinition<TItem, TId>> {
  const cellular = new RowKindCellularDefinition<TItem, TId>({
    cells: cellKinds,
    height: rowHeight,
  });

  const normalized = {
    ...(def.kindMap ?? {}),
    cellular,
  } as Record<string, AnyRowKindDefinition<TItem, TId>>;

  if (!normalized.default) {
    normalized.default = normalized.cellular;
  }

  return normalized;
}

export function defineGrid<TItem, TId extends ItemId = string>(
  definition: GridDefinition<TItem, TId>
): GridConfig<TItem, TId> {
  const rowHeight = definition.rowHeight ?? GRID_DEFAULT_ROW_HEIGHT;
  const cellKinds = definition.columns.map((column) => column.cell);

  return {
    ...definition,
    rowHeight,
    defaultKind: 'cellular',
    getRowKind: definition.getRowKind ?? (() => 'cellular'),
    columnCoreDefs: definition.columns.map((column) => column.core),
    columnViewDefs: definition.columns.map((column) => column.view),
    cellKinds,
    kindMap: normalizeKindMap(definition, cellKinds, rowHeight),
  };
}




