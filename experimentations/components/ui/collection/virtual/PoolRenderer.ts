import type { ReactNode } from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import { updateWithInheritance } from '@/core/collection/shared/kind/inheritance';
import { isJSXDescriptor } from '@/core/collection/shared/kind/jsx-descriptor';
import type { ItemId } from '@/core/collection/shared/runtime';
import {
  createJSXSlotRenderer,
  type JSXSlotRenderer,
} from './JSXSlotRenderer';
import { resolveKindDefinition } from './kind.utils';
import { JSX_KIND_HOST_REUSE_MARKER } from './kind/jsx-kind';

type Modifiers = { ctrl: boolean; meta: boolean; shift: boolean };

export interface PoolCallbacks {
  onClickItem?: (visibleIndex: number, modifiers: Modifiers) => void;
  onActivateItem?: (visibleIndex: number) => void;
  onToggleCheckboxItem?: (visibleIndex: number) => void;
}

export interface PooledItem {
  el: HTMLDivElement;
  kind: string;
  domRefs: unknown;
  jsxRenderer: JSXSlotRenderer | null;
  pendingJsx: ReactNode | null;
  lastJsx: ReactNode | null;
  lastItemId: string | null;
  lastItemRef: unknown;
  appliedStyleKeys: string[];
}

function isJSXHostReusableKind<TItem, TId extends ItemId>(
  kindDef: AnyRowKindDefinition<TItem, TId>
): boolean {
  return Reflect.get(kindDef, JSX_KIND_HOST_REUSE_MARKER) === true;
}

function hasReusableJSXHost(domRefs: unknown): domRefs is { jsxHostEl: HTMLElement } {
  if (!domRefs || typeof domRefs !== 'object') {
    return false;
  }

  const keys = Object.keys(domRefs as object);
  return keys.length === 1 && keys[0] === 'jsxHostEl'
    && ((domRefs as { jsxHostEl?: unknown }).jsxHostEl instanceof HTMLElement);
}

function resetPooledItemElement(el: HTMLDivElement, kind: string) {
  el.className = 'list-pooled-item';
  el.dataset.kind = kind;
}

function applyPooledItemBaseStyle(el: HTMLDivElement, height: number) {
  el.style.height = `${height}px`;
}

function patchPooledItemStyle(pooled: PooledItem, style: Partial<CSSStyleDeclaration> | undefined) {
  const elStyle = pooled.el.style as CSSStyleDeclaration & Record<string, string>;
  const previousKeys = pooled.appliedStyleKeys;

  if (!style) {
    for (const key of previousKeys) {
      elStyle[key] = '';
    }
    pooled.appliedStyleKeys = [];
    return;
  }

  const nextEntries = Object.entries(style);
  const nextKeys = nextEntries.map(([key]) => key);
  const nextKeySet = new Set(nextKeys);

  for (const key of previousKeys) {
    if (!nextKeySet.has(key)) {
      elStyle[key] = '';
    }
  }

  for (const [key, value] of nextEntries) {
    if (value == null) {
      elStyle[key] = '';
      continue;
    }
    elStyle[key] = String(value);
  }

  pooled.appliedStyleKeys = nextKeys;
}

function recreatePooledItem<TItem, TId extends ItemId>(
  pooled: PooledItem,
  kindDef: AnyRowKindDefinition<TItem, TId>
) {
  if (pooled.jsxRenderer) {
    pooled.jsxRenderer = null;
    pooled.pendingJsx = null;
  }
  pooled.el.innerHTML = '';
  pooled.domRefs = null;
  pooled.domRefs = kindDef.create(pooled.el);
  pooled.kind = kindDef.kind;
  pooled.lastJsx = null;
  pooled.lastItemId = null;
  pooled.lastItemRef = undefined;
  pooled.appliedStyleKeys = [];
  resetPooledItemElement(pooled.el, kindDef.kind);
}

function readVisibleIndex(el: HTMLDivElement): number | null {
  const raw = el.dataset.visibleIndex;
  if (raw == null || raw.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function resolveJSXHostElement(pooled: PooledItem): HTMLElement {
  const refs = pooled.domRefs as { jsxHostEl?: HTMLElement } | undefined;
  const host = refs?.jsxHostEl;
  if (!host && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[List] Kind returns JSXDescriptor but create() did not return jsxHostEl; '
      + 'falling back to pooled.el'
    );
  }
  return host ?? pooled.el;
}

export function createItemPool<TItem, TId extends ItemId>(
  container: HTMLElement,
  poolSize: number,
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  callbacks: PoolCallbacks = {}
): PooledItem[] {
  const initialKindDef = resolveKindDefinition(kindMap, 'default');
  const pool: PooledItem[] = [];

  for (let index = 0; index < poolSize; index++) {
    const el = document.createElement('div');
    el.style.display = 'none';
    el.dataset.visibleIndex = '';
    el.dataset.poolIndex = String(index);
    resetPooledItemElement(el, initialKindDef.kind);

    el.addEventListener('click', (event) => {
      const visibleIndex = readVisibleIndex(el);
      if (visibleIndex == null) return;
      callbacks.onClickItem?.(visibleIndex, {
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      });
    });

    el.addEventListener('dblclick', () => {
      const visibleIndex = readVisibleIndex(el);
      if (visibleIndex == null) return;
      callbacks.onActivateItem?.(visibleIndex);
    });

    el.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.dataset.listCheckbox !== 'true') {
        return;
      }
      const visibleIndex = readVisibleIndex(el);
      if (visibleIndex == null) return;
      callbacks.onToggleCheckboxItem?.(visibleIndex);
    });

    const domRefs = initialKindDef.create(el);
    container.appendChild(el);
    pool.push({
      el,
      kind: initialKindDef.kind,
      domRefs,
      jsxRenderer: null,
      pendingJsx: null,
      lastJsx: null,
      lastItemId: null,
      lastItemRef: undefined,
      appliedStyleKeys: [],
    });
  }

  return pool;
}

export function updatePooledItem<TItem, TId extends ItemId>(
  pooled: PooledItem,
  itemId: TId,
  visibleIndex: number,
  kind: string,
  descriptor: ItemDescriptor,
  height: number,
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>,
  itemRef?: TItem
): void {
  const previousKindDef = resolveKindDefinition(kindMap, pooled.kind);
  const kindDef = resolveKindDefinition(kindMap, kind);
  const isKindChanged = pooled.kind !== kindDef.kind;
  const canReuseJSXHost =
    isKindChanged
    && isJSXDescriptor(descriptor)
    && pooled.jsxRenderer != null
    && hasReusableJSXHost(pooled.domRefs)
    && isJSXHostReusableKind(previousKindDef)
    && isJSXHostReusableKind(kindDef);

  if (isKindChanged && !canReuseJSXHost) {
    recreatePooledItem(pooled, kindDef);
  } else if (isKindChanged) {
    pooled.kind = kindDef.kind;
  }

  pooled.el.dataset.visibleIndex = String(visibleIndex);
  pooled.el.dataset.kind = kindDef.kind;
  applyPooledItemBaseStyle(pooled.el, height);

  const nextClassName = descriptor.className
    ? `list-pooled-item ${descriptor.className}`
    : 'list-pooled-item';
  if (pooled.el.className !== nextClassName) {
    pooled.el.className = nextClassName;
  }

  patchPooledItemStyle(pooled, descriptor.style);

  updateWithInheritance(kindMap, kindDef.kind, pooled.domRefs, descriptor);

  if (isJSXDescriptor(descriptor)) {
    const refs = pooled.domRefs as { jsxHostEl?: HTMLElement } | undefined;
    if (!refs?.jsxHostEl) {
      recreatePooledItem(pooled, kindDef);
    }

    const hostEl = resolveJSXHostElement(pooled);
    let jsxRendererRecreated = false;
    if (!pooled.jsxRenderer || pooled.jsxRenderer.hostEl !== hostEl) {
      pooled.jsxRenderer = createJSXSlotRenderer(hostEl);
      pooled.pendingJsx = null;
      jsxRendererRecreated = true;
      pooled.lastJsx = null;
      pooled.lastItemId = null;
      pooled.lastItemRef = undefined;
    }

    const nextJsx = descriptor.jsx as ReactNode;
    const itemUnchanged = !jsxRendererRecreated
      && pooled.lastItemId === String(itemId)
      && pooled.lastItemRef === itemRef
      && pooled.lastJsx === nextJsx
      && itemRef !== undefined;

    if (!itemUnchanged) {
      pooled.lastItemId = String(itemId);
      pooled.lastItemRef = itemRef;
      pooled.lastJsx = nextJsx;
      pooled.pendingJsx = nextJsx;
    }
  } else if (pooled.jsxRenderer) {
    pooled.lastJsx = null;
    pooled.lastItemId = null;
    pooled.lastItemRef = undefined;
    pooled.pendingJsx = null;
  }
}

export function destroyItemPool(pool: PooledItem[]): void {
  for (const pooled of pool) {
    if (pooled.jsxRenderer) {
      pooled.jsxRenderer = null;
    }
    pooled.lastJsx = null;
    pooled.pendingJsx = null;
    pooled.lastItemId = null;
    pooled.lastItemRef = undefined;
    pooled.appliedStyleKeys = [];
  }
}



