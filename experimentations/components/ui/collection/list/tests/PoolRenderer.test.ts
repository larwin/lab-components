import { describe, it, expect, vi } from 'vitest';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import type { ItemDescriptor } from '@/core/collection/list/kind/types';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createItemPool, updatePooledItem } from '@/components/ui/collection/virtual/PoolRenderer';

interface TestItem {
  id: string;
  label: string;
}

interface TestDOMRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
  checkboxEl: HTMLInputElement;
}

interface TestDescriptor extends ItemDescriptor {
  label?: string;
  checked?: boolean;
}

function createRuntime(kind: string): ItemRuntime {
  return {
    kind,
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
  };
}

function createKind(kind: string, updateSpy = vi.fn()): AnyRowKindDefinition<TestItem, string> {
  return {
    kind,
    height: 28,
    computeDescriptor(item) {
      return { label: item.label };
    },
    create(container) {
      const rootEl = document.createElement('div');
      rootEl.dataset.kindRoot = kind;

      const checkboxEl = document.createElement('input');
      checkboxEl.type = 'checkbox';
      checkboxEl.dataset.listCheckbox = 'true';

      const labelEl = document.createElement('span');
      labelEl.className = 'label';

      rootEl.appendChild(checkboxEl);
      rootEl.appendChild(labelEl);
      container.appendChild(rootEl);

      return { rootEl, labelEl, checkboxEl };
    },
    update(refs: TestDOMRefs, descriptor: TestDescriptor) {
      refs.labelEl.textContent = descriptor.label ?? '';
      refs.rootEl.className = descriptor.className ?? '';
      refs.checkboxEl.checked = descriptor.checked ?? false;
      if (descriptor.style) {
        Object.assign(refs.rootEl.style, descriptor.style);
      }
      updateSpy(refs, descriptor);
    },
  };
}

describe('PoolRenderer', () => {
  it('createItemPool creates pooled items and mounts them in the container', () => {
    const container = document.createElement('div');
    const pool = createItemPool<TestItem, string>(
      container,
      3,
      { default: createKind('text') },
      {}
    );

    expect(pool).toHaveLength(3);
    expect(container.children).toHaveLength(3);
    expect(pool[0]?.kind).toBe('text');
    expect(pool[0]?.el.dataset.poolIndex).toBe('0');
  });

  it('updatePooledItem applies descriptor and updates DOM', () => {
    const container = document.createElement('div');
    const updateSpy = vi.fn();
    const pool = createItemPool<TestItem, string>(
      container,
      1,
      { default: createKind('text', updateSpy) },
      {}
    );

    updatePooledItem(
      pool[0],
      'item-1',
      0,
      'text',
      {
        label: 'Alpha',
        className: 'is-focused',
      } as TestDescriptor,
      36,
      { default: createKind('text', updateSpy), text: createKind('text', updateSpy) }
    );

    expect(pool[0].el.dataset.visibleIndex).toBe('0');
    expect(pool[0].el.style.height).toBe('36px');
    expect(pool[0].el.className).toContain('is-focused');
    expect(pool[0].el.querySelector('.label')?.textContent).toBe('Alpha');
    expect(updateSpy).toHaveBeenCalled();
  });

  it('recreates pooled DOM when item kind changes', () => {
    const container = document.createElement('div');
    const textKind = createKind('text');
    const badgeKind = createKind('badge');
    const pool = createItemPool<TestItem, string>(
      container,
      1,
      { default: textKind, text: textKind, badge: badgeKind },
      {}
    );

    const firstKindRoot = pool[0].el.querySelector('[data-kind-root]') as HTMLDivElement;
    expect(firstKindRoot.dataset.kindRoot).toBe('text');

    updatePooledItem(
      pool[0],
      'item-2',
      0,
      'badge',
      { label: 'Beta' } as TestDescriptor,
      32,
      { default: textKind, text: textKind, badge: badgeKind }
    );

    const secondKindRoot = pool[0].el.querySelector('[data-kind-root]') as HTMLDivElement;
    expect(pool[0].kind).toBe('badge');
    expect(secondKindRoot.dataset.kindRoot).toBe('badge');
  });

  it('wires click, activate and checkbox callbacks', () => {
    const container = document.createElement('div');
    const onClickItem = vi.fn();
    const onActivateItem = vi.fn();
    const onToggleCheckboxItem = vi.fn();
    const pool = createItemPool<TestItem, string>(
      container,
      1,
      { default: createKind('text') },
      { onClickItem, onActivateItem, onToggleCheckboxItem }
    );

    updatePooledItem(
      pool[0],
      'item-3',
      0,
      'text',
      { label: 'Gamma', checked: false } as TestDescriptor,
      30,
      { default: createKind('text'), text: createKind('text') }
    );

    pool[0].el.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    pool[0].el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const checkbox = pool[0].el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onClickItem).toHaveBeenCalledWith(0, { ctrl: true, meta: false, shift: false });
    expect(onActivateItem).toHaveBeenCalledWith(0);
    expect(onToggleCheckboxItem).toHaveBeenCalledWith(0);
  });

  it('uses explicit kind parameter instead of current pooled kind', () => {
    const container = document.createElement('div');
    const textKind = createKind('text');
    const badgeKind = createKind('badge');
    const pool = createItemPool<TestItem, string>(
      container,
      1,
      { default: textKind, text: textKind, badge: badgeKind },
      {}
    );

    expect(pool[0].kind).toBe('text');

    updatePooledItem(
      pool[0],
      'item-9',
      0,
      'badge',
      { label: 'Kind by param' } as TestDescriptor,
      28,
      { default: textKind, text: textKind, badge: badgeKind }
    );

    expect(pool[0].kind).toBe('badge');
    expect(pool[0].el.dataset.kind).toBe('badge');
    expect(pool[0].el.textContent).toContain('Kind by param');
  });

  it('skips JSX root.render when only wrapper state changes for same item reference', () => {
    interface JsxDOMRefs {
      jsxHostEl: HTMLDivElement;
    }

    const jsxKind: AnyRowKindDefinition<TestItem, string> = {
      kind: 'jsx',
      height: 30,
      computeDescriptor(item, _id, runtime) {
        return {
          className: runtime.isFocused ? 'is-focused' : '',
          jsx: item.label,
        };
      },
      create(container) {
        const jsxHostEl = document.createElement('div');
        container.appendChild(jsxHostEl);
        return { jsxHostEl } as JsxDOMRefs;
      },
      update() {},
    };

    const kindMap = {
      default: jsxKind,
      jsx: jsxKind,
    };

    const container = document.createElement('div');
    const pool = createItemPool<TestItem, string>(container, 1, kindMap, {});
    const itemRef = { id: 'item-1', label: 'Alpha' };

    updatePooledItem(
      pool[0],
      'item-1',
      0,
      'jsx',
      { className: 'normal', jsx: 'Alpha' } as unknown as TestDescriptor,
      30,
      kindMap,
      itemRef
    );

    const pendingJsxBefore = pool[0].pendingJsx;

    updatePooledItem(
      pool[0],
      'item-1',
      0,
      'jsx',
      { className: 'is-focused', jsx: 'Alpha' } as unknown as TestDescriptor,
      30,
      kindMap,
      itemRef
    );

    expect(pool[0].pendingJsx).toBe(pendingJsxBefore);
    expect(pool[0].el.className).toContain('is-focused');
  });
});






