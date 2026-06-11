import { describe, expect, it, vi } from 'vitest';
import { FLAT_HIERARCHY } from '@/core/collection/shared/hierarchy';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { CellKindDefinition } from '../cell';
import { RowKindCellularDefinition } from '../cellular';

interface RowItem {
  id: string;
  name: string;
  age: number;
}

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'cellular',
    isFocused: false,
    isSelected: false,
    isChecked: false,
    isDisabled: false,
    isExpanded: false,
    isExpandable: false,
    isVisible: true,
    hierarchy: FLAT_HIERARCHY,
    ...overrides,
  };
}

function createCells(): Array<CellKindDefinition<RowItem, string, ItemRuntime>> {
  return [
    {
      columnId: 'name',
      getValue: (row) => row.name,
      getDisplay: (_row, _id, _runtime, value) => String(value).toUpperCase(),
    },
    {
      columnId: 'age',
      getValue: (row) => row.age,
      getDisplay: (_row, _id, _runtime, value) => `${value}y`,
      getClassName: (_row, _id, _runtime, value) => Number(value) >= 30 ? 'is-senior' : undefined,
    },
  ];
}

describe('RowKindCellularDefinition', () => {
  it('computes one descriptor cell per column and resolves display values', () => {
    const getDisplaySpy = vi.fn((_row: RowItem, _id: string, _runtime: ItemRuntime, value: unknown) => `${value}!`);
    const kind = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 36,
      cells: [
        { columnId: 'name', getValue: (row) => row.name, getDisplay: getDisplaySpy },
        { columnId: 'age', getValue: (row) => row.age },
      ],
    });

    const descriptor = kind.computeDescriptor(
      { id: 'r1', name: 'Alice', age: 31 },
      'r1',
      createRuntime({ isSelected: true, isFocused: true }),
    );

    expect(descriptor.cells).toHaveLength(2);
    expect(descriptor.cells[0]).toMatchObject({
      columnId: 'name',
      value: 'Alice',
      displayValue: 'Alice!',
    });
    expect(descriptor.cells[1]).toMatchObject({
      columnId: 'age',
      value: 31,
      displayValue: 31,
    });
    expect(descriptor.className).toContain('is-selected');
    expect(descriptor.className).toContain('is-focused');
    expect(getDisplaySpy).toHaveBeenCalledTimes(1);
  });

  it('creates and updates DOM cells', () => {
    const kind = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 40,
      cells: createCells(),
    });

    const host = document.createElement('div');
    const refs = kind.create(host);

    expect(refs.cellEls).toHaveLength(2);
    expect(refs.valueEls).toHaveLength(2);

    const descriptor = kind.computeDescriptor(
      { id: 'r2', name: 'Bob', age: 42 },
      'r2',
      createRuntime({ isFocused: true }),
    );
    kind.update(refs, descriptor);

    expect(refs.valueEls[0].textContent).toBe('BOB');
    expect(refs.valueEls[1].textContent).toBe('42y');
    expect(refs.cellEls[1].className).toContain('is-senior');
    expect(refs.contentEl.className).toContain('is-focused');
  });

  it('keeps layout driven by CSS class after partial style updates', () => {
    const kind = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 40,
      cells: [
        {
          columnId: 'name',
          getValue: (row) => row.name,
          getStyle: () => ({ width: '120px' }),
        },
      ],
    });

    const host = document.createElement('div');
    const refs = kind.create(host);
    const cellEl = refs.cellEls[0];

    expect(cellEl.className).toContain('grid-cell');
    expect(cellEl.style.display).toBe('');
    expect(cellEl.style.padding).toBe('');
    expect(cellEl.style.flex).toBe('');

    const descriptor = kind.computeDescriptor(
      { id: 'r3', name: 'Zoe', age: 25 },
      'r3',
      createRuntime(),
    );
    kind.update(refs, descriptor);

    expect(cellEl.className).toContain('grid-cell');
    expect(cellEl.style.width).toBe('120px');
    expect(cellEl.style.display).toBe('');
    expect(cellEl.style.padding).toBe('');
    expect(cellEl.style.flex).toBe('');
  });

  it('renders action buttons when a cell displayValue contains row actions', () => {
    const kind = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 40,
      cells: [
        {
          columnId: 'actions',
          getValue: () => ({ row: ['edit', 'delete'] }),
        },
      ],
    });

    const host = document.createElement('div');
    const refs = kind.create(host);

    const descriptor = kind.computeDescriptor(
      { id: 'r4', name: 'Nina', age: 33 },
      'r4',
      createRuntime(),
    );
    kind.update(refs, descriptor);

    const buttons = refs.valueEls[0].querySelectorAll('[data-grid-action]');
    expect(buttons).toHaveLength(2);
    expect((buttons[0] as HTMLElement).dataset.gridAction).toBe('edit');
    expect((buttons[1] as HTMLElement).dataset.gridAction).toBe('delete');
  });

  it('applies hierarchy indentation and expand glyph for hierarchy columns', () => {
    const kind = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 40,
      cells: [
        {
          columnId: 'name',
          isHierarchyColumn: true,
          getValue: (row) => row.name,
        },
      ],
    });

    const host = document.createElement('div');
    const refs = kind.create(host);

    const descriptor = kind.computeDescriptor(
      { id: 'r5', name: 'Child', age: 18 },
      'r5',
      createRuntime({
        isExpandable: true,
        isExpanded: true,
        hierarchy: {
          depth: 2,
          parentId: 'parent',
          childrenIds: [],
          hasChildren: false,
        },
      }),
    );
    kind.update(refs, descriptor);

    expect(refs.cellEls[0].style.paddingLeft).toBe('32px');
    expect(refs.valueEls[0].textContent).toBe('▼ Child');
  });
});



