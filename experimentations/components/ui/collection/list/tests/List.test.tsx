import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { RowKindDefinition } from '@/core/collection/list/kind/types';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import type { ListHandle } from '../List';
import { TestControlledList } from './TestControlledList';

interface Item {
  id: string;
  label: string;
}

interface NumericItem {
  id: number;
  label: string;
}

interface InteractiveDescriptor {
  label: string;
  className?: string;
  checked: boolean;
}

interface InteractiveRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
  checkboxEl: HTMLInputElement;
}

const interactiveKind: RowKindDefinition<
  Item,
  string,
  ItemRuntime,
  InteractiveDescriptor,
  InteractiveRefs
> = {
  kind: 'interactive',
  height: 32,
  computeDescriptor: (item, _id, runtime) => ({
    label: item.label,
    className: runtime.isFocused ? 'is-focused' : '',
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
    refs.rootEl.className = descriptor.className ?? '';
    refs.checkboxEl.checked = descriptor.checked;
  },
};

function createDefinition() {
  return defineCollection<Item>({
    getItemId: (item) => item.id,
    getItemKind: () => 'interactive',
    kindMap: {
      interactive: interactiveKind as any,
    },
  });
}

function getVisiblePoolRows(): HTMLDivElement[] {
  const poolContainer = screen.getByTestId('virtual-pool-container');
  return Array.from(poolContainer.children)
    .filter((child) => (child as HTMLDivElement).style.display !== 'none') as HTMLDivElement[];
}

describe('List', () => {
  it('renders empty state with 0 items', () => {
    render(<TestControlledList items={[]} definition={createDefinition()} />);
    expect(screen.getByTestId('virtual-pool-empty')).toBeInTheDocument();
  });

  it('renders 1 item and keeps virtualization pool active', async () => {
    render(<TestControlledList items={[{ id: 'a', label: 'Alpha' }]} definition={createDefinition()} />);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    const poolContainer = screen.getByTestId('virtual-pool-container');
    expect(poolContainer.children.length).toBeGreaterThan(1);
  });

  it('renders multiple items', async () => {
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ]}
        definition={createDefinition()}
      />
    );

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('supports keyboard navigation intents (Arrow/Home/End)', async () => {
    const onLastEffect = vi.fn();
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
        onLastEffect={onLastEffect}
      />
    );

    const container = screen.getByTestId('list-container');
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    fireEvent.keyDown(container, { key: 'ArrowUp' });
    fireEvent.keyDown(container, { key: 'Home' });
    fireEvent.keyDown(container, { key: 'End' });

    await waitFor(() => {
      expect(onLastEffect).toHaveBeenCalledWith({ type: 'FOCUS_DOM_ITEM', itemId: 'b' });
      expect(onLastEffect).toHaveBeenCalledWith({ type: 'SCROLL_TO_ITEM', itemId: 'b', align: 'auto' });
    });
  });

  it('updates selection on click', async () => {
    const onSelectionChange = vi.fn();
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(await screen.findByText('Beta'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['b']));
    });
  });

  it('keeps numeric item ids when selection comes from pooled click events', async () => {
    const onSelectionChange = vi.fn();
    const numericDefinition = defineCollection<NumericItem, number>({
      getItemId: (item) => item.id,
      getItemKind: () => 'interactive',
      kindMap: {
        interactive: interactiveKind as any,
      },
    });

    render(
      <TestControlledList<NumericItem, number>
        items={[
          { id: 1, label: 'One' },
          { id: 2, label: 'Two' },
        ]}
        definition={numericDefinition}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(await screen.findByText('Two'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(new Set([2]));
    });
  });

  it('updates checked ids from checkbox toggle', async () => {
    const onCheckedChange = vi.fn();
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
        onCheckedChange={onCheckedChange}
      />
    );

    const checkbox = (await screen.findByText('Alpha')).parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.change(checkbox);

    await waitFor(() => {
      const lastCall = onCheckedChange.mock.calls.at(-1)?.[0] as Set<string>;
      expect(lastCall.has('a')).toBe(true);
    });
  });

  it('shows loading overlay', () => {
    render(
      <TestControlledList
        items={[{ id: 'a', label: 'Alpha' }]}
        definition={createDefinition()}
        isLoading
      />
    );

    expect(screen.getByTestId('virtual-pool-loading')).toBeInTheDocument();
  });

  it('keeps tabIndex only on container', async () => {
    render(
      <TestControlledList
        items={[{ id: 'a', label: 'Alpha' }]}
        definition={createDefinition()}
      />
    );

    const container = screen.getByTestId('list-container');
    expect(container).toHaveAttribute('tabindex', '0');

    await screen.findByText('Alpha');
    const poolContainer = screen.getByTestId('virtual-pool-container');
    const firstPooledItem = poolContainer.children[0] as HTMLDivElement;
    expect(firstPooledItem.getAttribute('tabindex')).toBeNull();
  });

  it('focuses the list container after item click focus effect', async () => {
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
      />
    );

    const container = screen.getByTestId('list-container');
    fireEvent.click(await screen.findByText('Alpha'));

    await waitFor(() => {
      expect(document.activeElement).toBe(container);
    });
  });

  it('exposes focus() via ref which focuses the container', () => {
    const listRef = createRef<ListHandle>();

    render(
      <TestControlledList
        ref={listRef}
        items={[{ id: 'a', label: 'Alpha' }]}
        definition={createDefinition()}
      />
    );

    const container = screen.getByTestId('list-container');
    listRef.current?.focus();
    expect(document.activeElement).toBe(container);
  });

  it('applies zebra tone classes from visible item parity', async () => {
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ]}
        definition={createDefinition()}
        rowTone="zebra"
      />
    );

    await screen.findByText('Alpha');

    await waitFor(() => {
      const rows = getVisiblePoolRows();
      const rowA = rows.find((row) => row.dataset.visibleIndex === '0');
      const rowB = rows.find((row) => row.dataset.visibleIndex === '1');
      const rowC = rows.find((row) => row.dataset.visibleIndex === '2');

      expect(rowA).toBeDefined();
      expect(rowB).toBeDefined();
      expect(rowC).toBeDefined();
      expect(rowA).not.toHaveClass('is-zebra-alt');
      expect(rowB).toHaveClass('is-zebra-alt');
      expect(rowC).not.toHaveClass('is-zebra-alt');
    });
  });

  it('does not apply zebra classes in default tone', async () => {
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
      />
    );

    await screen.findByText('Alpha');

    const rows = getVisiblePoolRows();
    expect(rows.some((row) => row.classList.contains('is-zebra-alt'))).toBe(false);
  });

  it('exposes aria-activedescendant and option roles for list context', async () => {
    render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
      />
    );

    const container = screen.getByTestId('list-container');
    expect(container).toHaveAttribute('role', 'listbox');

    fireEvent.keyDown(container, { key: 'ArrowDown' });

    await waitFor(() => {
      const activeId = container.getAttribute('aria-activedescendant');
      expect(activeId).toBeTruthy();
      const activeRow = document.getElementById(activeId!);
      expect(activeRow).toHaveAttribute('role', 'option');
      expect(activeRow).toHaveAttribute('aria-selected', 'false');
    });
  });

  it('cancels pending animation frame on unmount', async () => {
    const requestSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { unmount } = render(
      <TestControlledList
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        definition={createDefinition()}
      />
    );

    await screen.findByText('Alpha');
    const scrollEl = screen.getByTestId('virtual-pool-scroll');
    scrollEl.scrollTop = 24;
    fireEvent.scroll(scrollEl);

    expect(requestSpy).toHaveBeenCalled();

    unmount();

    expect(cancelSpy).toHaveBeenCalledWith(42);

    requestSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});





