import { useMemo } from 'react';
import type { FilterExpr, SortSpec } from '@/core/collection/grid/state/types';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import { resolveI18nText } from '@/core/culture';
import type { ItemId } from '@/core/collection/shared/runtime';
import { adaptGridToCollectionConfig } from '@/core/collection/grid/adapter';
import { toGridConfig, type GridConfig, type GridDefinition } from '@/core/collection/grid/definition/facade';
import { applyGridSortFilter } from '@/core/collection/grid/extensions/sortfilter';
import { createCellularKind } from '../presets/CellularRowKind';

export interface GridHeaderColumn {
  id: string;
  headerText: string;
  sortable: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

interface UseGridModelOptions<TItem, TId extends ItemId> {
  rows: TItem[];
  definition: GridDefinition<TItem, TId> | GridConfig<TItem, TId>;
  sortSpec: SortSpec[];
  filterExpr: FilterExpr | null;
}

export function useGridModel<TItem, TId extends ItemId>({
  rows,
  definition,
  sortSpec,
  filterExpr,
}: UseGridModelOptions<TItem, TId>) {
  const config = useMemo(() => toGridConfig(definition), [definition]);

  const visibleRows = useMemo(
    () => applyGridSortFilter(rows, config.getRowId, sortSpec, filterExpr, config.columnCoreDefs),
    [rows, config.getRowId, sortSpec, filterExpr, config.columnCoreDefs],
  );

  const listKindMap = useMemo(() => {
    const cellularKind = createCellularKind(config.columns, {
      height: config.rowHeight,
      culture: config.culture,
    });

    const baseKindMap = config.kindMap as Record<string, AnyRowKindDefinition<TItem, TId>>;
    const nextKindMap: Record<string, AnyRowKindDefinition<TItem, TId>> = {
      ...baseKindMap,
      cellular: cellularKind,
    };

    if (!baseKindMap.default || baseKindMap.default === baseKindMap.cellular) {
      nextKindMap.default = cellularKind;
    }

    return nextKindMap;
  }, [config]);

  const listDefinition = useMemo(
    () => adaptGridToCollectionConfig(config, listKindMap),
    [config, listKindMap]
  );

  const coreColumnById = useMemo(
    () => new Map(config.columnCoreDefs.map((column) => [column.id, column])),
    [config.columnCoreDefs]
  );

  const headerColumns = useMemo(
    (): GridHeaderColumn[] => config.columnViewDefs.map((columnView) => {
      const core = coreColumnById.get(columnView.id);

      return {
        id: columnView.id,
        headerText: resolveI18nText(columnView.header, config.culture?.translate),
        sortable: Boolean(core?.sortable),
        width: columnView.width,
        minWidth: columnView.minWidth,
        maxWidth: columnView.maxWidth,
        align: columnView.align ?? 'left',
      };
    }),
    [config.columnViewDefs, config.culture, coreColumnById],
  );

  return {
    config,
    listDefinition,
    visibleRows,
    headerColumns,
  };
}



