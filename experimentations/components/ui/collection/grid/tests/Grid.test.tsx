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

interface NumericRowItem {
  id: number;
  name: string;
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
      width: 180,
    }),
    defineColumn<RowItem>({
      id: 'age',
      header: 'Age',
      kind: 'number',
      getValue: (row) => row.age,
      sortable: true,
      align: 'right',
      width: 96,
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
      width: 180,
    }),
    defineColumn<RowItem>({
      id: 'actions',
      header: 'Actions',
      kind: 'action',
      getValue: () => ({ row: ['edit', 'delete'] }),
      width: 120,
    }),
  ],
});

const treeRows: RowItem[] = [
  { id: 'dept', name: 'Department', age: 0, parentId: null },
  { id: 'a', name: 'Alice', age: 27, parentId: 'dept' },
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
      width: 220,
    }),
  ],
});

const numericRows: NumericRowItem[] = [
  { id: 1, name: 'One' },
  { id: 2, name: 'Two' },
];

const numericDefinition = defineGrid<NumericRowItem, number>({
  getRowId: (row) => row.id,
  columns: [
    defineColumn<NumericRowItem, number>({
      id: 'name',
      header: 'Name',
      getValue: (row) => row.name,
      sortable: true,
      width: 180,
    }),
  ],
});

function getVisiblePoolRows(): HTMLDivElement[] {
  const pool = screen.getByTestId('virtual-pool-container');
  return Array.from(pool.children)
    .filter((child) => (child as HTMLDivElement).style.display !== 'none') as HTMLDivElement[];
}

describe('Grid', () => {
  it('renders rows and sorts when clicking sortable headers', async () => {
    render(<Grid rows={rows} definition={definition} />);

    await screen.findByText('Charlie');
    expect(getVisiblePoolRows()[0].textContent).toContain('Charlie');

    fireEvent.click(screen.getByRole('columnheader', { name: /name/i }));

    await waitFor(() => {
      expect(getVisiblePoolRows()[0].textContent).toContain('Alice');
    });
  });

  it('supports imperative filter and sort API via ref', async () => {
    const ref = createRef<GridHandle>();
    render(<Grid ref={ref} rows={rows} definition={definition} />);

    await screen.findByText('Charlie');

    act(() => {
      ref.current?.setFilter({ kind: 'leaf', columnId: 'name', op: 'contains', value: 'bo' });
    });

    await waitFor(() => {
      const visible = getVisiblePoolRows();
      expect(visible).toHaveLength(1);
      expect(visible[0].textContent).toContain('Bob');
    });

    act(() => {
      ref.current?.setSort([{ columnId: 'age', direction: 'desc' }]);
      ref.current?.setFilter(null);
    });

    await waitFor(() => {
      expect(getVisiblePoolRows()[0].textContent).toContain('Charlie');
    });
  });

  it('forwards selection changes from List', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Grid
        rows={rows}
        definition={definition}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(await screen.findByText('Alice'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['r2']));
    });
  });

  it('keeps numeric row ids when selection is driven by pooled row clicks', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Grid
        rows={numericRows}
        definition={numericDefinition}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(await screen.findByText('Two'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(new Set([2]));
    });
  });

  it('emits row action intent/effect and callback when clicking an action button', async () => {
    const onLastIntent = vi.fn();
    const onLastEffect = vi.fn();
    const onExecuteRowAction = vi.fn();

    render(
      <Grid
        rows={rows}
        definition={actionsDefinition}
        onLastIntent={onLastIntent}
        onLastEffect={onLastEffect}
        onExecuteRowAction={onExecuteRowAction}
      />,
    );

    await screen.findByText('Charlie');

    const actionButton = document.querySelector('[data-grid-action="edit"]') as HTMLButtonElement | null;
    expect(actionButton).not.toBeNull();

    fireEvent.click(actionButton!);

    await waitFor(() => {
      expect(onLastIntent).toHaveBeenCalledWith({
        type: 'EXECUTE_ROW_ACTION',
        itemId: 'r1',
        actionId: 'edit',
      });
      expect(onLastEffect).toHaveBeenCalledWith({
        type: 'EMIT_ROW_ACTION',
        itemId: 'r1',
        actionId: 'edit',
      });
      expect(onExecuteRowAction).toHaveBeenCalledWith('r1', 'edit');
    });
  });

  it('shows only roots then expands children on double-click with hierarchy indentation', async () => {
    render(
      <Grid
        rows={treeRows}
        definition={treeDefinition}
      />,
    );

    expect(screen.getByTestId('list-container')).toHaveAttribute('role', 'tree');

    const parentLabel = await screen.findByText(/Department/);
    expect(parentLabel).toBeInTheDocument();
    expect(screen.queryByText(/Alice/)).toBeNull();

    const parentCell = parentLabel.closest('.grid-cell') as HTMLDivElement | null;
    expect(parentCell).not.toBeNull();
    expect(parentCell!.style.paddingLeft).toBe('0px');
    const parentRow = parentLabel.closest('.list-pooled-item');
    expect(parentRow).toHaveAttribute('role', 'treeitem');
    expect(parentRow).toHaveAttribute('aria-expanded', 'false');

    fireEvent.dblClick(parentLabel);

    await waitFor(() => {
      const childLabel = screen.getByText(/Alice/);
      expect(childLabel).toBeInTheDocument();
      const childCell = childLabel.closest('.grid-cell') as HTMLDivElement | null;
      expect(childCell).not.toBeNull();
      expect(childCell!.style.paddingLeft).toBe('16px');
      const expandedParentRow = screen.getByText(/Department/).closest('.list-pooled-item');
      expect(expandedParentRow).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('resizes a column and emits RESIZE_COLUMN intent on release', async () => {
    const onLastIntent = vi.fn();
    render(<Grid rows={rows} definition={definition} onLastIntent={onLastIntent} />);

    const headers = screen.getAllByRole('columnheader') as HTMLDivElement[];
    const rects = [
      { left: 0, right: 180 },
      { left: 180, right: 276 },
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
    fireEvent.mouseDown(resizeHandle, { clientX: 180, clientY: 8 });
    fireEvent.mouseMove(window, { clientX: 230, clientY: 8 });
    fireEvent.mouseUp(window, { clientX: 230, clientY: 8 });

    await waitFor(() => {
      expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'RESIZE_COLUMN',
        columnId: 'name',
        width: 230,
      }));
    });
  });

  it('reorders columns when dragging a header handle', async () => {
    const onLastIntent = vi.fn();
    render(<Grid rows={rows} definition={definition} onLastIntent={onLastIntent} />);

    const headers = screen.getAllByRole('columnheader') as HTMLDivElement[];
    const rects = [
      { left: 0, right: 180 },
      { left: 180, right: 276 },
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

    const dragHandle = headers[0]!.querySelector('[data-grid-drag-handle="true"]') as HTMLElement;
    fireEvent.mouseDown(dragHandle, { clientX: 10, clientY: 8 });
    fireEvent.mouseMove(window, { clientX: 260, clientY: 8 });
    fireEvent.mouseUp(window, { clientX: 260, clientY: 8 });

    await waitFor(() => {
      const headerTexts = screen
        .getAllByRole('columnheader')
        .map((header) => header.querySelector('[data-grid-header-content="true"]')?.textContent ?? '');
      expect(headerTexts[0]).toContain('Age');
      expect(headerTexts[1]).toContain('Name');
      expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'REORDER_COLUMNS',
        draggedKeys: ['name'],
      }));
    });
  });

  it('forwards zebra row tone to the underlying list rows', async () => {
    render(<Grid rows={rows} definition={definition} rowTone="zebra" />);

    await screen.findByText('Charlie');

    await waitFor(() => {
      const visibleRows = getVisiblePoolRows();
      const rowR1 = visibleRows.find((row) => row.dataset.visibleIndex === '0');
      const rowR2 = visibleRows.find((row) => row.dataset.visibleIndex === '1');
      const rowR3 = visibleRows.find((row) => row.dataset.visibleIndex === '2');

      expect(rowR1).toBeDefined();
      expect(rowR2).toBeDefined();
      expect(rowR3).toBeDefined();
      expect(rowR1).not.toHaveClass('is-zebra-alt');
      expect(rowR2).toHaveClass('is-zebra-alt');
      expect(rowR3).not.toHaveClass('is-zebra-alt');
    });
  });

  it('applies custom width to the grid root container', async () => {
    const { container, rerender } = render(<Grid rows={rows} definition={definition} width={720} />);
    await screen.findByText('Charlie');

    const gridRoot = container.querySelector('.grid-root') as HTMLDivElement | null;
    expect(gridRoot).not.toBeNull();
    expect(gridRoot!.style.width).toBe('720px');

    rerender(<Grid rows={rows} definition={definition} width="75%" />);
    expect(gridRoot!.style.width).toBe('75%');
  });

  it('syncs header horizontal offset with body scrollLeft', async () => {
    render(<Grid rows={rows} definition={definition} width={200} />);
    await screen.findByText('Charlie');

    const listScroll = screen.getByTestId('virtual-pool-scroll');
    const headerRow = screen.getByRole('row');

    listScroll.scrollLeft = 40;
    fireEvent.scroll(listScroll);

    await waitFor(() => {
      expect(headerRow).toHaveStyle({ transform: 'translate3d(-40px, 0, 0)' });
    });
  });
});





