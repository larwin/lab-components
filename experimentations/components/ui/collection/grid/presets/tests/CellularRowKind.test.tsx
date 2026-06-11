import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defineColumn } from '@/core/collection/grid';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { createCellularKind } from '../CellularRowKind';

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
    hierarchy: {
      depth: 0,
      parentId: null,
      childrenIds: [],
      hasChildren: false,
    },
    ...overrides,
  };
}

describe('CellularRowKind', () => {
  it('builds descriptor with one cell per column and renders JSX', () => {
    const columns = [
      defineColumn<RowItem>({
        id: 'name',
        header: 'Name',
        getValue: (row) => row.name,
      }),
      defineColumn<RowItem>({
        id: 'age',
        header: 'Age',
        kind: 'number',
        getValue: (row) => row.age,
        align: 'right',
      }),
    ];
    const kind = createCellularKind<RowItem>(columns, { height: 40 });
    const descriptor = kind.computeDescriptor(
      { id: 'r1', name: 'Alice', age: 29 },
      'r1',
      createRuntime(),
    ) as JSXDescriptor & { cells: Array<{ columnId: string }> };

    expect(descriptor.cells).toHaveLength(2);

    const { container } = render(<>{descriptor.jsx}</>);
    expect(container.querySelectorAll('[data-column-id]')).toHaveLength(2);
    expect(container.querySelector('[data-column-id="name"]')).not.toBeNull();
    expect(container.querySelector('[data-column-id="age"]')).not.toBeNull();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
  });
});




