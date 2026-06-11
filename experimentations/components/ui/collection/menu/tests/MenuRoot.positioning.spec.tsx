import { useEffect, useRef, type ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuDefinition } from '@/core/collection/menu';
import { MenuRoot } from '../MenuRoot';
import { useMenuController } from '../useMenuController';

const definition: MenuDefinition<string> = {
  key: 'position-root',
  items: [
    { id: 'open', kind: 'action', actionId: 'open', label: 'Open' },
  ],
};

function Harness({ x, y }: { x: number; y: number }): ReactElement {
  const controller = useMenuController<string>();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    controller.openMenu(definition, { x, y });
  }, [controller, x, y]);

  return <MenuRoot controller={controller} />;
}

describe('MenuRoot positioning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps root menu placement to viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 120,
      width: 200,
      height: 120,
      toJSON: () => '',
    }));

    render(<Harness x={760} y={560} />);

    const container = await screen.findByTestId('menu-root-container');
    await waitFor(() => {
      expect(container.style.left).toBe('592px');
      expect(container.style.top).toBe('472px');
    });
  });
});





