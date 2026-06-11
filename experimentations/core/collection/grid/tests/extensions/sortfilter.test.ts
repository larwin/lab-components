import { describe, expect, it } from 'vitest';
import { defineColumn } from '../../definition/column';
import { applyGridSortFilter } from '../../extensions/sortfilter';

interface RowItem {
  id: string;
  name: string;
  age: number;
}

const rows: RowItem[] = [
  { id: 'r1', name: 'Charlie', age: 34 },
  { id: 'r2', name: 'Alice', age: 27 },
  { id: 'r3', name: 'Bob', age: 31 },
];

const columns = [
  defineColumn<RowItem>({ id: 'name', header: 'Name', kind: 'string', getValue: (row) => row.name }).core,
  defineColumn<RowItem>({ id: 'age', header: 'Age', kind: 'number', getValue: (row) => row.age }).core,
];

describe('applyGridSortFilter', () => {
  it('sorts rows using wrapped v1 sort pipeline', () => {
    const result = applyGridSortFilter(
      rows,
      (row) => row.id,
      [{ columnId: 'name', direction: 'asc' }],
      null,
      columns,
    );

    expect(result.map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('filters rows using wrapped v1 filter pipeline', () => {
    const result = applyGridSortFilter(
      rows,
      (row) => row.id,
      [],
      { kind: 'leaf', columnId: 'name', op: 'contains', value: 'bo' },
      columns,
    );

    expect(result.map((row) => row.id)).toEqual(['r3']);
  });
});

