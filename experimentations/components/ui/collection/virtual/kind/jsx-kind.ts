import React from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { JSXDescriptor } from '@/core/collection/shared/kind/jsx-descriptor';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

interface JSXKindDOMRefs {
  jsxHostEl: HTMLDivElement;
}

export interface JSXKindOptions<TItem, TId extends ItemId, TDescriptor extends ItemDescriptor> {
  kind: string;
  height: number;
  extends?: string;
  computeDescriptor: (
    item: TItem,
    id: TId,
    runtime: ItemRuntime,
    culture?: unknown
  ) => TDescriptor;
  Component: React.ComponentType<TDescriptor>;
}

export const JSX_KIND_HOST_REUSE_MARKER = '__collectionJSXHostReuse';

export function createJSXKind<TItem, TId extends ItemId, TDescriptor extends ItemDescriptor>(
  options: JSXKindOptions<TItem, TId, TDescriptor>
): AnyRowKindDefinition<TItem, TId> {
  const kindDef: AnyRowKindDefinition<TItem, TId> = {
    kind: options.kind,
    height: options.height,
    extends: options.extends,
    computeDescriptor(item, id, runtime, culture) {
      const descriptor = options.computeDescriptor(item, id, runtime, culture);
      return {
        ...descriptor,
        jsx: React.createElement(options.Component, descriptor),
      } as JSXDescriptor;
    },
    create(container) {
      const jsxHostEl = document.createElement('div');
      jsxHostEl.style.cssText = 'display:contents;';
      container.appendChild(jsxHostEl);
      return { jsxHostEl } satisfies JSXKindDOMRefs;
    },
    update() {
      // No-op: re-rendering is driven by JSXSlotRenderer, which calls
      // root.render(descriptor.jsx) on jsxHostEl after updatePooledItem().
      // Any kind returning a JSXDescriptor must rely on that mechanism.
    },
  };

  Reflect.set(kindDef, JSX_KIND_HOST_REUSE_MARKER, true);
  return kindDef;
}



