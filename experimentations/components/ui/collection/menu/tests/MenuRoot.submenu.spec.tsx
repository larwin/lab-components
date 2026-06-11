import { act, useEffect, useRef, type ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuDefinition } from '@/core/collection/menu';
import { MenuRoot } from '../MenuRoot';
import { useMenuController } from '../useMenuController';

const definition: MenuDefinition<string> = {
  key: 'submenu-root',
  options: {
    hoverOpenDelayMs: 150,
  },
  items: [
    {
      id: 'more',
      kind: 'action',
      actionId: 'more',
      label: 'More',
      submenu: {
        key: 'child-menu',
        items: [
          { id: 'child-a', kind: 'action', actionId: 'child-a', label: 'Child A' },
        ],
      },
    },
    { id: 'leaf', kind: 'action', actionId: 'leaf', label: 'Leaf' },
  ],
};

function Harness(): ReactElement {
  const controller = useMenuController<string>();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(definition, { x: 160, y: 90 });
  }, [controller]);

  return <MenuRoot controller={controller} />;
}

describe('MenuRoot submenu', () => {
  it('opens submenu after hover delay', async () => {
    render(<Harness />);

    const opener = await screen.findByText('More');
    vi.useFakeTimers();
    fireEvent.mouseOver(opener);

    expect(screen.queryByTestId('menu-level-layer-level-1')).toBeNull();

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
      expect(screen.getByText('Child A')).toBeInTheDocument();
    });
  });
});





