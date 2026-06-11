import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import { createActionKind } from '../ActionRowKind';

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'action',
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

describe('ActionRowKind', () => {
  it('creates jsxHostEl + arrowEl and toggles arrow visibility in update()', () => {
    const kind = createActionKind<string>();
    const container = document.createElement('div');
    const refs = kind.create(container) as { jsxHostEl: HTMLDivElement; arrowEl: HTMLSpanElement };

    expect(refs.jsxHostEl).toBeDefined();
    expect(refs.arrowEl).toBeDefined();
    expect(container.contains(refs.jsxHostEl)).toBe(true);
    expect(container.contains(refs.arrowEl)).toBe(true);
    expect(container.style.display).toBe('flex');

    kind.update(refs as never, {
      label: 'Open',
      icon: null,
      hasSubmenu: true,
      isDisabled: false,
    } as never);
    expect(refs.arrowEl.style.display).toBe('');

    kind.update(refs as never, {
      label: 'Open',
      icon: null,
      hasSubmenu: false,
      isDisabled: false,
    } as never);
    expect(refs.arrowEl.style.display).toBe('none');
  });

  it('computes JSX descriptor and renders label/icon', () => {
    const kind = createActionKind<string>();
    const item = {
      id: 'open',
      kind: 'action',
      actionId: 'open',
      label: 'Open',
      icon: 'folder',
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime()) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('folder')).toBeInTheDocument();
  });
});




