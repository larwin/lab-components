import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defineColumn, defineGrid } from '@/core/collection/grid';
import { useGridModel } from '../useGridModel';

interface RowItem {
  id: string;
  name: string;
  age: number;
  parentId?: string | null;
}

const rows: RowItem[] = [
  { id: 'r1', name: 'Charlie', age: 34 },
  { id: 'r2', name: 'Alice', age: 27 },
  { id: 'r3', name: 'Bob', age: 31 },
];

const definition = defineGrid<RowItem>({
  getRowId: (row) => row.id,
  columns: [
    defineColumn<RowItem>({
      id: 'name',
      header: 'Name',
      getValue: (row) => row.name,
      sortable: true,
    }),
    defineColumn<RowItem>({
      id: 'age',
      header: 'Age',
      kind: 'number',
      getValue: (row) => row.age,
      sortable: true,
      align: 'right',
      width: 100,
    }),
  ],
});

describe('useGridModel', () => {
  it('maps grid definition to list definition and header model', () => {
    const { result } = renderHook(() => useGridModel({
      rows,
      definition,
      sortSpec: [],
      filterExpr: null,
    }));

    expect(result.current.listDefinition.kindMap.cellular).toBeDefined();
    expect(result.current.headerColumns.map((column) => column.headerText)).toEqual(['Name', 'Age']);
    expect(result.current.headerColumns[1]).toMatchObject({
      align: 'right',
      width: 100,
      sortable: true,
    });
  });

  it('applies sort/filter before passing rows to List', () => {
    const { result } = renderHook(() => useGridModel({
      rows,
      definition,
      sortSpec: [{ columnId: 'name', direction: 'asc' }],
      filterExpr: { kind: 'leaf', columnId: 'name', op: 'contains', value: 'a' },
    }));

    expect(result.current.visibleRows.map((row) => row.id)).toEqual(['r2', 'r1']);
  });

  it('keeps hierarchy in list definition and leaves row flattening to List', () => {
    const treeRows: RowItem[] = [
      { id: 'dept', name: 'Department', age: 0, parentId: null },
      { id: 'a', name: 'Alice', age: 27, parentId: 'dept' },
      { id: 'b', name: 'Bob', age: 31, parentId: 'dept' },
    ];
    const treeDefinition = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      hierarchy: {
        getId: (row) => row.id,
        getParentId: (row) => row.parentId ?? null,
      },
      columns: [
        defineColumn<RowItem>({
          id: 'name',
          header: 'Name',
          kind: 'hierarchy',
          getValue: (row) => row.name,
        }),
      ],
    });

    const { result } = renderHook(() => useGridModel({
      rows: treeRows,
      definition: treeDefinition,
      sortSpec: [],
      filterExpr: null,
    }));

    expect(result.current.visibleRows.map((row) => row.id)).toEqual(['dept', 'a', 'b']);
    expect(result.current.listDefinition.hierarchy).toBeDefined();
  });
});




