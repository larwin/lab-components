import { describe, expect, it } from 'vitest';
import { applyFilter, applySort, applySortFilter } from '../sortfilter.pipeline';
import type { ColumnCoreDef } from '../../definition/column.core';

interface RowItem {
  id: string;
  name: string;
  age: number;
  role: string;
  team?: string | null;
}

const rows: RowItem[] = [
  { id: 'a', name: 'Charlie', age: 35, role: 'Lead', team: 'A' },
  { id: 'b', name: 'Alice', age: 30, role: 'Engineer', team: 'B' },
  { id: 'c', name: 'Bob', age: 25, role: 'Engineer', team: null },
  { id: 'd', name: 'Diana', age: 28, role: 'Designer', team: undefined },
  { id: 'e', name: 'Alice', age: 22, role: 'Designer', team: 'C' },
];

const rawById = new Map(rows.map((row) => [row.id, row] as const));
const ids = rows.map((row) => row.id);

const columns: Array<ColumnCoreDef<RowItem>> = [
  {
    id: 'name',
    kind: 'string',
    sortable: true,
    filterable: true,
    getValue: (row) => row.name,
  },
  {
    id: 'age',
    kind: 'number',
    sortable: true,
    filterable: true,
    getValue: (row) => row.age,
  },
  {
    id: 'role',
    kind: 'string',
    sortable: true,
    filterable: true,
    getValue: (row) => row.role,
  },
  {
    id: 'team',
    kind: 'string',
    sortable: true,
    filterable: true,
    getValue: (row) => row.team,
  },
];

describe('applyFilter', () => {
  it('returns original ids when filter is null', () => {
    expect(applyFilter(ids, rawById, null, columns)).toEqual(ids);
  });

  it('supports eq / neq / contains / gt / lt operators', () => {
    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'role', op: 'eq', value: 'Engineer' }, columns),
    ).toEqual(['b', 'c']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'role', op: 'neq', value: 'Engineer' }, columns),
    ).toEqual(['a', 'd', 'e']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'name', op: 'contains', value: 'ali' }, columns),
    ).toEqual(['b', 'e']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'age', op: 'gt', value: 29 }, columns),
    ).toEqual(['a', 'b']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'age', op: 'lt', value: 29 }, columns),
    ).toEqual(['c', 'd', 'e']);
  });

  it('supports and / or / not trees', () => {
    expect(
      applyFilter(
        ids,
        rawById,
        {
          kind: 'and',
          children: [
            { kind: 'leaf', columnId: 'role', op: 'eq', value: 'Designer' },
            { kind: 'leaf', columnId: 'name', op: 'contains', value: 'ali' },
          ],
        },
        columns,
      ),
    ).toEqual(['e']);

    expect(
      applyFilter(
        ids,
        rawById,
        {
          kind: 'or',
          children: [
            { kind: 'leaf', columnId: 'name', op: 'eq', value: 'Charlie' },
            { kind: 'leaf', columnId: 'name', op: 'eq', value: 'Bob' },
          ],
        },
        columns,
      ),
    ).toEqual(['a', 'c']);

    expect(
      applyFilter(
        ids,
        rawById,
        {
          kind: 'not',
          child: { kind: 'leaf', columnId: 'role', op: 'eq', value: 'Engineer' },
        },
        columns,
      ),
    ).toEqual(['a', 'd', 'e']);
  });

  it('supports in / notIn and validates array values', () => {
    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'role', op: 'in', value: ['Engineer', 'Lead'] }, columns),
    ).toEqual(['a', 'b', 'c']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'age', op: 'in', value: [22, 28] }, columns),
    ).toEqual(['d', 'e']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'role', op: 'notIn', value: ['Engineer'] }, columns),
    ).toEqual(['a', 'd', 'e']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'team', op: 'in', value: [null, undefined] }, columns),
    ).toEqual(['c', 'd']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'team', op: 'notIn', value: [null, undefined] }, columns),
    ).toEqual(['a', 'b', 'e']);

    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'role', op: 'in', value: 'Engineer' }, columns),
    ).toEqual([]);
  });

  it('keeps permissive behavior when column is missing', () => {
    expect(
      applyFilter(ids, rawById, { kind: 'leaf', columnId: 'unknown', op: 'in', value: ['anything'] }, columns),
    ).toEqual(ids);
  });
});

describe('applySort', () => {
  it('sorts ascending and descending', () => {
    expect(applySort(ids, rawById, [{ columnId: 'name', direction: 'asc' }], columns)).toEqual([
      'b',
      'e',
      'c',
      'a',
      'd',
    ]);

    expect(applySort(ids, rawById, [{ columnId: 'age', direction: 'desc' }], columns)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
  });

  it('supports multi-column sort', () => {
    expect(
      applySort(
        ids,
        rawById,
        [
          { columnId: 'name', direction: 'asc' },
          { columnId: 'age', direction: 'asc' },
        ],
        columns,
      ),
    ).toEqual(['e', 'b', 'c', 'a', 'd']);
  });

  it('returns original order when sort spec is empty', () => {
    expect(applySort(ids, rawById, [], columns)).toEqual(ids);
  });
});

describe('applySortFilter', () => {
  it('combines filtering then sorting', () => {
    expect(
      applySortFilter(
        ids,
        rawById,
        [{ columnId: 'age', direction: 'asc' }],
        { kind: 'leaf', columnId: 'role', op: 'eq', value: 'Engineer' },
        columns,
      ),
    ).toEqual(['c', 'b']);
  });
});


