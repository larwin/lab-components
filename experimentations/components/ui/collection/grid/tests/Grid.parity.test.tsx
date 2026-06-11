import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineColumn, defineGrid } from '@/core/collection/grid';
import { Grid, type GridHandle } from '../Grid';

interface RowItem {
  id: string;
  name: string;
  age: number;
  parentId?: string | null;
}

const rows: RowItem[] = [
  { id: 'r1', name: 'Alice', age: 29 },
  { id: 'r2', name: 'Bob', age: 34 },
  { id: 'r3', name: 'Charlie', age: 41 },
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
    }),
  ],
});

const actionsDefinition = defineGrid<RowItem>({
  getRowId: (row) => row.id,
  columns: [
    defineColumn<RowItem>({
      id: 'name',
      header: 'Name',
      getValue: (row) => row.name,
    }),
    defineColumn<RowItem>({
      id: 'actions',
      header: 'Actions',
      kind: 'action',
      getValue: () => ({ row: ['edit'] }),
      width: 100,
    }),
  ],
});

const treeRows: RowItem[] = [
  { id: 'dept', name: 'Department', age: 0, parentId: null },
  { id: 'r4', name: 'Delta', age: 22, parentId: 'dept' },
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
      sortable: true,
      width: 180,
    }),
  ],
});

describe('Grid parity baseline', () => {
  it('keeps keyboard focus navigation behavior', async () => {
    const onLastEffect = vi.fn();

    render(
      <Grid
        rows={rows}
        definition={definition}
        onLastEffect={onLastEffect}
      />,
    );

    const listContainer = screen.getByTestId('list-container');
    fireEvent.keyDown(listContainer, { key: 'ArrowDown' });
    fireEvent.keyDown(listContainer, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(onLastEffect).toHaveBeenCalledWith({ type: 'FOCUS_DOM_ITEM', itemId: 'r1' });
      expect(onLastEffect).toHaveBeenCalledWith({ type: 'FOCUS_DOM_ITEM', itemId: 'r2' });
    });
  });

  it('keeps multi-selection ctrl-click behavior', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Grid
        rows={rows}
        definition={definition}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(await screen.findByText('Alice'));
    fireEvent.click(screen.getByText('Bob'), { ctrlKey: true });

    await waitFor(() => {
      const last = onSelectionChange.mock.calls.at(-1)?.[0] as Set<string>;
      expect(last).toEqual(new Set(['r1', 'r2']));
    });
  });

  it('keeps imperative filter/sort behavior', async () => {
    const ref = createRef<GridHandle>();

    render(<Grid ref={ref} rows={rows} definition={definition} />);
    await screen.findByText('Alice');

    act(() => {
      ref.current?.setFilter({ kind: 'leaf', columnId: 'name', op: 'contains', value: 'bo' });
    });

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    act(() => {
      ref.current?.setFilter(null);
    });
    fireEvent.click(screen.getByRole('columnheader', { name: /age/i }));

    await waitFor(() => {
      expect(screen.getAllByText('41').length).toBeGreaterThan(0);
    });
  });

  it('keeps row action emission behavior', async () => {
    const onExecuteRowAction = vi.fn();

    render(
      <Grid
        rows={rows}
        definition={actionsDefinition}
        onExecuteRowAction={onExecuteRowAction}
      />,
    );
    await screen.findByText('Alice');

    const actionButton = document.querySelector('[data-grid-action="edit"]') as HTMLButtonElement | null;
    expect(actionButton).not.toBeNull();
    fireEvent.click(actionButton!);

    await waitFor(() => {
      expect(onExecuteRowAction).toHaveBeenCalledWith('r1', 'edit');
    });
  });

  it('keeps tree expand/collapse behavior', async () => {
    render(<Grid rows={treeRows} definition={treeDefinition} />);

    const parentLabel = await screen.findByText(/Department/);
    expect(parentLabel).toBeInTheDocument();
    expect(screen.queryByText(/Delta/)).toBeNull();

    const parentCell = parentLabel.closest('.grid-cell') as HTMLDivElement | null;
    expect(parentCell).not.toBeNull();
    expect(parentCell!.style.paddingLeft).toBe('0px');

    fireEvent.dblClick(parentLabel);

    await waitFor(() => {
      const childLabel = screen.getByText(/Delta/);
      expect(childLabel).toBeInTheDocument();
      const childCell = childLabel.closest('.grid-cell') as HTMLDivElement | null;
      expect(childCell).not.toBeNull();
      expect(childCell!.style.paddingLeft).toBe('16px');
    });
  });

  it('keeps resize and reorder column intents', async () => {
    const onLastIntent = vi.fn();
    render(<Grid rows={rows} definition={definition} onLastIntent={onLastIntent} />);

    const headers = screen.getAllByRole('columnheader') as HTMLDivElement[];
    const rects = [
      { left: 0, right: 160 },
      { left: 160, right: 320 },
    ];
    headers.forEach((header, index) => {
      Object.defineProperty(header, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          x: rects[index]!.left,
          y: 0,
          width: rects[index]!.right - rects[index]!.left,
          height: 32,
          top: 0,
          bottom: 32,
          left: rects[index]!.left,
          right: rects[index]!.right,
          toJSON: () => ({}),
        }),
      });
    });

    const resizeHandle = headers[0]!.querySelector('[data-grid-resize-handle="true"]') as HTMLElement;
    fireEvent.mouseDown(resizeHandle, { clientX: 160, clientY: 8 });
    fireEvent.mouseMove(window, { clientX: 210, clientY: 8 });
    fireEvent.mouseUp(window, { clientX: 210, clientY: 8 });

    const dragHandle = headers[0]!.querySelector('[data-grid-drag-handle="true"]') as HTMLElement;
    fireEvent.mouseDown(dragHandle, { clientX: 10, clientY: 8 });
    fireEvent.mouseMove(window, { clientX: 280, clientY: 8 });
    fireEvent.mouseUp(window, { clientX: 280, clientY: 8 });

    await waitFor(() => {
      expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESIZE_COLUMN' }));
      expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({ type: 'REORDER_COLUMNS' }));
    });
  });
});




