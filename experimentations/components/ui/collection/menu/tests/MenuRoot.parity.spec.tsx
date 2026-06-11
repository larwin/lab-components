import { act, useEffect, useRef, type ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuDefinition } from '@/core/collection/menu';
import { MenuRoot } from '../MenuRoot';
import { useMenuController } from '../useMenuController';

const parityDefinition: MenuDefinition<string> = {
  key: 'parity-root',
  options: {
    hoverOpenDelayMs: 150,
    inputApplyDebounceMs: 120,
  },
  items: [
    {
      id: 'more',
      kind: 'action',
      actionId: 'more',
      label: 'More',
      submenu: {
        key: 'parity-child',
        items: [
          { id: 'child-a', kind: 'action', actionId: 'child-a', label: 'Child A' },
        ],
      },
    },
    { id: 'open', kind: 'action', actionId: 'open', label: 'Open' },
    { id: 'filter', kind: 'input', label: 'Filter', draft: '' },
    { id: 'status', kind: 'enum', label: 'Status', values: ['active', 'paused'], selectedValues: [] },
  ],
};

const checkboxDefinition: MenuDefinition<string> = {
  key: 'parity-checkbox',
  items: [
    { id: 'check', kind: 'checkbox', label: 'Include archived' },
  ],
};

function ParityHarness({
  onExecute,
  onFilter,
}: {
  onExecute?: (itemId: string, actionId: string) => void;
  onFilter?: (itemId: string, value: string | string[] | null) => void;
}): ReactElement {
  const controller = useMenuController<string>({
    onExecute,
    onColumnFilterChange: onFilter,
  });
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(parityDefinition, { x: 140, y: 90 });
  }, [controller]);

  return <MenuRoot controller={controller} />;
}

function CheckboxHarness(): ReactElement {
  const controller = useMenuController<string>();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(checkboxDefinition, { x: 160, y: 100 });
  }, [controller]);

  return <MenuRoot controller={controller} />;
}

describe('MenuRoot parity baseline', () => {
  it('keeps cascade open/close behavior with Escape', async () => {
    render(<ParityHarness />);

    await screen.findByTestId('menu-root-container');
    fireEvent.click(screen.getByText('More'));

    await waitFor(() => {
      expect(screen.getByTestId('menu-level-layer-level-1')).toBeInTheDocument();
    });

    const listContainers = screen.getAllByTestId('list-container');
    fireEvent.keyDown(listContainers[1]!, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('menu-level-layer-level-1')).toBeNull();
      expect(screen.getByTestId('menu-root-container')).toBeInTheDocument();
    });
  });

  it('keeps hover-open delay behavior', async () => {
    render(<ParityHarness />);

    const more = await screen.findByText('More');
    vi.useFakeTimers();
    fireEvent.mouseOver(more);

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.queryByTestId('menu-level-layer-level-1')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId('menu-level-layer-level-1')).toBeInTheDocument();
    });
  });

  it('keeps debounce input, enum toggle and action callback behavior', async () => {
    const onExecute = vi.fn();
    const onFilter = vi.fn();
    render(<ParityHarness onExecute={onExecute} onFilter={onFilter} />);

    const input = await screen.findByRole('textbox');
    vi.useFakeTimers();
    fireEvent.input(input, { target: { value: 'alice' } });

    act(() => {
      vi.advanceTimersByTime(120);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalledWith('filter', 'alice');
    });

    fireEvent.click(screen.getByRole('button', { name: 'active' }));
    await waitFor(() => {
      expect(onFilter).toHaveBeenCalledWith('status', ['active']);
    });

    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith('open', 'open');
    });
  });

  it('keeps checkbox toggle behavior', async () => {
    render(<CheckboxHarness />);

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
  });
});





