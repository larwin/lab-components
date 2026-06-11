import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { RowKindDefinition } from '@/core/collection/list/kind/types';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { TestControlledList } from './TestControlledList';

interface Item {
  id: string;
  label: string;
}

interface Descriptor {
  label: string;
  checked: boolean;
}

interface DOMRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
  checkboxEl: HTMLInputElement;
}

const interactiveKind: RowKindDefinition<Item, string, ItemRuntime, Descriptor, DOMRefs> = {
  kind: 'interactive',
  height: 30,
  computeDescriptor: (item, _id, runtime) => ({
    label: item.label,
    checked: runtime.isChecked,
  }),
  create: (container) => {
    const rootEl = document.createElement('div');
    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.dataset.listCheckbox = 'true';
    const labelEl = document.createElement('span');
    rootEl.appendChild(checkboxEl);
    rootEl.appendChild(labelEl);
    container.appendChild(rootEl);
    return { rootEl, labelEl, checkboxEl };
  },
  update: (refs, descriptor) => {
    refs.labelEl.textContent = descriptor.label;
    refs.checkboxEl.checked = descriptor.checked;
  },
};

describe('List integration', () => {
  it('supports defineCollection + render + keyboard + selection + checkbox + scroll', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      id: String(index + 1),
      label: `Item ${index + 1}`,
    }));
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      getItemKind: () => 'interactive',
      kindMap: {
        interactive: interactiveKind as any,
      },
    });

    const onSelectionChange = vi.fn();
    const onCheckedChange = vi.fn();
    const onActivate = vi.fn();
    const onLastEffect = vi.fn();

    render(
      <TestControlledList
        items={items}
        definition={definition}
        onSelectionChange={onSelectionChange}
        onCheckedChange={onCheckedChange}
        onActivate={onActivate}
        onLastEffect={onLastEffect}
      />
    );

    const listContainer = screen.getByTestId('list-container');
    const scrollContainer = screen.getByTestId('virtual-pool-scroll');

    fireEvent.keyDown(listContainer, { key: 'ArrowDown' });
    fireEvent.keyDown(listContainer, { key: 'Enter' });

    await waitFor(() => {
      expect(onLastEffect).toHaveBeenCalledWith({ type: 'FOCUS_DOM_ITEM', itemId: '1' });
      expect(onActivate).toHaveBeenCalledWith('1');
    });

    fireEvent.click(screen.getByText('Item 4'));
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['4']));
    });

    const checkbox = screen.getByText('Item 4').parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.change(checkbox);
    await waitFor(() => {
      const lastChecked = onCheckedChange.mock.calls.at(-1)?.[0] as Set<string>;
      expect(lastChecked.has('4')).toBe(true);
    });

    fireEvent.dblClick(screen.getByText('Item 4'));
    await waitFor(() => {
      expect(onActivate).toHaveBeenCalledWith('4');
    });

    fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });
    await waitFor(() => {
      const transform = screen.getByTestId('virtual-pool-container').style.transform;
      expect(transform).not.toBe('translate3d(0, 0px, 0)');
    });
  });
});





