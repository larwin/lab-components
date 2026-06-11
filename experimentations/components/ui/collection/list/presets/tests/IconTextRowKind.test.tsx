import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { JSXDescriptor } from '@/core/collection/list/kind/jsx-descriptor';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createIconTextKind } from '../IconTextRowKind';

interface Item {
  id: string;
  name: string;
  hasIcon?: boolean;
}

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'icon-text',
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

describe('IconTextRowKind', () => {
  it('creates a valid icon-text kind with default height', () => {
    const kind = createIconTextKind<Item>({
      getLabel: (item) => item.name,
    });

    expect(kind.kind).toBe('icon-text');
    expect(kind.height).toBe(LIST_DEFAULT_ITEM_HEIGHT);
  });

  it('computes label and optional icon descriptor', () => {
    const kind = createIconTextKind<Item>({
      getLabel: (item) => item.name,
      getIcon: (item) => (item.hasIcon ? <span data-testid="icon-node">I</span> : undefined),
    });
    const descriptor = kind.computeDescriptor(
      { id: '1', name: 'Alpha', hasIcon: true },
      '1',
      createRuntime(),
    ) as JSXDescriptor & { label: string; icon?: unknown };

    expect(descriptor.label).toBe('Alpha');
    expect(descriptor.icon).toBeTruthy();
    expect(descriptor.jsx).toBeTruthy();
  });

  it('creates jsxHostEl and update is a no-op', () => {
    const kind = createIconTextKind<Item>({
      getLabel: (item) => item.name,
    });
    const container = document.createElement('div');
    const refs = kind.create(container) as { jsxHostEl?: HTMLDivElement };
    const descriptor = kind.computeDescriptor(
      { id: '2', name: 'Beta' },
      '2',
      createRuntime(),
    );

    expect(refs.jsxHostEl).toBeDefined();
    expect(container.contains(refs.jsxHostEl as HTMLDivElement)).toBe(true);
    expect(() => kind.update(refs as never, descriptor as never)).not.toThrow();
  });

  it('does not render icon wrapper when icon is undefined', () => {
    const kind = createIconTextKind<Item>({
      getLabel: (item) => item.name,
    });
    const descriptor = kind.computeDescriptor(
      { id: '3', name: 'No Icon' },
      '3',
      createRuntime(),
    ) as JSXDescriptor;

    const { container } = render(<>{descriptor.jsx}</>);
    expect(screen.getByText('No Icon')).toBeInTheDocument();
    expect(container.querySelector('.list-preset-icon-text__icon')).toBeNull();
  });
});




