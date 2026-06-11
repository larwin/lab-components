import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import type { JSXDescriptor } from '@/core/collection/list/kind/jsx-descriptor';
import type { ItemDescriptor } from '@/core/collection/list/kind/types';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createJSXKind } from '../kind/jsx-kind';
import { createItemPool, destroyItemPool, updatePooledItem } from '@/components/ui/collection/virtual/PoolRenderer';

interface TestItem {
  id: string;
  label: string;
}

interface TextDescriptor extends ItemDescriptor {
  label: string;
}

interface TextRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
}

interface JSXRowDescriptor extends ItemDescriptor {
  label: string;
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

function createTextKind(): AnyRowKindDefinition<TestItem, string> {
  return {
    kind: 'text',
    height: 28,
    computeDescriptor(item) {
      return { label: item.label };
    },
    create(container) {
      const rootEl = document.createElement('div');
      rootEl.dataset.kindRoot = 'text';
      const labelEl = document.createElement('span');
      rootEl.appendChild(labelEl);
      container.appendChild(rootEl);
      return { rootEl, labelEl } as TextRefs;
    },
    update(refs: TextRefs, descriptor: TextDescriptor) {
      refs.labelEl.textContent = descriptor.label;
    },
  };
}

function JSXRow({ label }: JSXRowDescriptor) {
  return <span data-testid="pool-jsx-label">{label}</span>;
}

describe('pool JSX transition', () => {
  it('recreates domRefs and renderer when slot transitions DOM -> JSX -> DOM', () => {
    const textKind = createTextKind();
    const jsxKind = createJSXKind<TestItem, string, JSXRowDescriptor>({
      kind: 'jsx',
      height: 28,
      computeDescriptor: (item) => ({ label: item.label }),
      Component: JSXRow,
    });

    const kindMap = {
      default: textKind,
      text: textKind,
      jsx: jsxKind,
    };

    const poolContainer = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 1, kindMap, {});

    const firstItem = { id: 'a', label: 'Alpha' };
    updatePooledItem(
      pool[0],
      firstItem.id,
      0,
      'text',
      textKind.computeDescriptor(firstItem, firstItem.id, createRuntime('text')) as TextDescriptor,
      28,
      kindMap,
      firstItem
    );

    const domRefsText = pool[0].domRefs;
    expect(pool[0].kind).toBe('text');
    expect(pool[0].jsxRenderer).toBeNull();
    expect(pool[0].el.textContent).toContain('Alpha');

    const secondItem = { id: 'b', label: 'Beta' };
    updatePooledItem(
      pool[0],
      secondItem.id,
      0,
      'jsx',
      jsxKind.computeDescriptor(secondItem, secondItem.id, createRuntime('jsx')) as JSXDescriptor,
      28,
      kindMap,
      secondItem
    );

    const domRefsJsx = pool[0].domRefs;
    expect(pool[0].kind).toBe('jsx');
    expect(domRefsJsx).not.toBe(domRefsText);
    expect(pool[0].jsxRenderer).not.toBeNull();
    expect(pool[0].pendingJsx).not.toBeNull();

    const thirdItem = { id: 'c', label: 'Gamma' };
    updatePooledItem(
      pool[0],
      thirdItem.id,
      0,
      'text',
      textKind.computeDescriptor(thirdItem, thirdItem.id, createRuntime('text')) as TextDescriptor,
      28,
      kindMap,
      thirdItem
    );

    expect(pool[0].kind).toBe('text');
    expect(pool[0].domRefs).not.toBe(domRefsJsx);
    expect(pool[0].jsxRenderer).toBeNull();
    expect(pool[0].pendingJsx).toBeNull();
    expect(pool[0].el.textContent).toContain('Gamma');

    destroyItemPool(pool);
  });

  it('warns and falls back to pooled.el when jsxHostEl is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const badJsxKind: AnyRowKindDefinition<TestItem, string> = {
      kind: 'bad-jsx',
      height: 28,
      computeDescriptor(item) {
        return { jsx: item.label } as JSXDescriptor;
      },
      create() {
        return {};
      },
      update() {},
    };

    const kindMap = {
      default: badJsxKind,
      'bad-jsx': badJsxKind,
    };

    const poolContainer = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 1, kindMap, {});
    const item = { id: 'x', label: 'Xray' };

    updatePooledItem(
      pool[0],
      item.id,
      0,
      'bad-jsx',
      badJsxKind.computeDescriptor(item, item.id, createRuntime('bad-jsx')) as JSXDescriptor,
      28,
      kindMap,
      item
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '[List] Kind returns JSXDescriptor but create() did not return jsxHostEl; '
      + 'falling back to pooled.el'
    );
    expect(pool[0].jsxRenderer?.hostEl).toBe(pool[0].el);

    destroyItemPool(pool);
    warnSpy.mockRestore();
  });
});






