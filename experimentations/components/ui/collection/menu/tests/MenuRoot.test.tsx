import { act, useEffect, useRef, type ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuDefinition } from '@/core/collection/menu';
import { MenuRoot } from '../MenuRoot';
import { useMenuController } from '../useMenuController';

const definition: MenuDefinition<string> = {
  key: 'menu-root',
  options: {
    inputApplyDebounceMs: 120,
  },
  items: [
    { id: 'open', kind: 'action', actionId: 'open', label: 'Open' },
    { id: 'check', kind: 'checkbox', label: 'Include archived' },
    { id: 'filter', kind: 'input', label: 'Filter', draft: '' },
    { id: 'status', kind: 'enum', label: 'Status', values: ['active', 'paused'], selectedValues: [] },
  ],
};

const definitionWithHeader: MenuDefinition<string> = {
  key: 'menu-root-with-header',
  header: 'Quick actions',
  items: [
    { id: 'open', kind: 'action', actionId: 'open', label: 'Open' },
  ],
};

const definitionWithSubmenu: MenuDefinition<string> = {
  key: 'menu-root-submenu',
  items: [
    {
      id: 'parent',
      kind: 'action',
      actionId: 'parent',
      label: 'Parent',
      submenu: {
        key: 'submenu',
        items: [
          { id: 'child', kind: 'action', actionId: 'child', label: 'Child' },
        ],
      },
    },
    { id: 'other', kind: 'action', actionId: 'other', label: 'Other' },
  ],
};

const numericDefinition: MenuDefinition<number> = {
  key: 'menu-root-numeric',
  items: [
    { id: 101, kind: 'action', actionId: 'open', label: 'Open numeric' },
  ],
};

function MenuHarness({
  onExecute,
  onColumnFilterChange,
  menuDefinition = definition,
}: {
  onExecute?: (itemId: string, actionId: string) => void;
  onColumnFilterChange?: (itemId: string, value: string | string[] | null) => void;
  menuDefinition?: MenuDefinition<string>;
}): ReactElement {
  const controller = useMenuController<string>({
    onExecute,
    onColumnFilterChange,
  });
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(menuDefinition, { x: 120, y: 80 });
  }, [controller, menuDefinition]);

  return <MenuRoot controller={controller} />;
}

function HeaderHarness(): ReactElement {
  const controller = useMenuController<string>();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(definitionWithHeader, { x: 120, y: 80 });
  }, [controller]);

  return <MenuRoot controller={controller} />;
}

function NumericMenuHarness({
  onExecute,
}: {
  onExecute?: (itemId: number, actionId: string) => void;
}): ReactElement {
  const controller = useMenuController<number>({
    onExecute,
  });
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(numericDefinition, { x: 120, y: 80 });
  }, [controller]);

  return <MenuRoot controller={controller} />;
}

describe('MenuRoot', () => {
  it('renders and executes action items', async () => {
    const onExecute = vi.fn();
    render(<MenuHarness onExecute={onExecute} />);

    const openLabel = await screen.findByText('Open');
    const container = screen.getByTestId('list-container');
    expect(container).toHaveAttribute('role', 'menu');
    const openRow = openLabel.closest('.list-pooled-item');
    expect(openRow).toHaveAttribute('role', 'menuitem');
    fireEvent.click(openLabel);

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith('open', 'open');
    });
  });

  it('applies input filter after debounce', async () => {
    const onColumnFilterChange = vi.fn();
    render(<MenuHarness onColumnFilterChange={onColumnFilterChange} />);

    const input = await screen.findByRole('textbox');
    vi.useFakeTimers();
    fireEvent.input(input, { target: { value: 'alice' } });

    expect(onColumnFilterChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(120);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(onColumnFilterChange).toHaveBeenCalledWith('filter', 'alice');
    });
  });

  it('applies input filter on blur', async () => {
    const onColumnFilterChange = vi.fn();
    render(<MenuHarness onColumnFilterChange={onColumnFilterChange} />);

    const input = await screen.findByRole('textbox');
    fireEvent.input(input, { target: { value: 'bob' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onColumnFilterChange).toHaveBeenCalledWith('filter', 'bob');
    });
  });

  it('emits column filter change once when blur happens before debounce flush', async () => {
    const onColumnFilterChange = vi.fn();
    render(<MenuHarness onColumnFilterChange={onColumnFilterChange} />);

    const input = await screen.findByRole('textbox');
    vi.useFakeTimers();
    try {
      fireEvent.input(input, { target: { value: 'bob' } });
      fireEvent.blur(input);

      act(() => {
        vi.advanceTimersByTime(200);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(onColumnFilterChange).toHaveBeenCalledTimes(1);
    expect(onColumnFilterChange).toHaveBeenCalledWith('filter', 'bob');
  });

  it('updates checkbox runtime state from pool events', async () => {
    render(<MenuHarness />);

    const resolveCheckbox = () => (
      screen
        .getByText('Include archived')
        .closest('.list-pooled-item')
        ?.querySelector('input[type="checkbox"]')
    ) as HTMLInputElement;

    expect(resolveCheckbox().checked).toBe(false);
    expect(resolveCheckbox().closest('.list-pooled-item')).toHaveAttribute('role', 'menuitemcheckbox');

    fireEvent.click(resolveCheckbox());

    await waitFor(() => {
      expect(resolveCheckbox().checked).toBe(true);
    });
  });

  it('renders overlay and closes menu on overlay mousedown', async () => {
    render(<MenuHarness />);

    const overlay = await screen.findByTestId('menu-overlay');
    expect(screen.getByTestId('menu-root-container')).toBeInTheDocument();

    fireEvent.mouseDown(overlay);

    await waitFor(() => {
      expect(screen.queryByTestId('menu-root-container')).toBeNull();
    });
  });

  it('renders optional level header', async () => {
    render(<HeaderHarness />);

    expect(await screen.findByText('Quick actions')).toBeInTheDocument();
  });

  it('keeps parent focus in sync after closing a submenu', async () => {
    render(<MenuHarness menuDefinition={definitionWithSubmenu} />);

    fireEvent.click(await screen.findByText('Parent'));

    await waitFor(() => {
      expect(screen.getByTestId('menu-level-layer-level-1')).toBeInTheDocument();
    });

    const listContainers = screen.getAllByTestId('list-container');
    fireEvent.keyDown(listContainers[listContainers.length - 1], { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.queryByTestId('menu-level-layer-level-1')).toBeNull();
    });

    const rootContainer = screen.getByTestId('list-container');
    fireEvent.keyDown(rootContainer, { key: 'ArrowDown' });

    await waitFor(() => {
      const parentRow = screen.getByText('Parent').closest('.list-pooled-item');
      const otherRow = screen.getByText('Other').closest('.list-pooled-item');
      expect(parentRow).not.toHaveClass('is-focused');
      expect(otherRow).toHaveClass('is-focused');
    });
  });

  it('keeps numeric ids through execute callbacks', async () => {
    const onExecute = vi.fn();
    render(<NumericMenuHarness onExecute={onExecute} />);

    fireEvent.click(await screen.findByText('Open numeric'));

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith(101, 'open');
    });
  });
});





