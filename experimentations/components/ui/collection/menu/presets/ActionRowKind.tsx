import React from 'react';
import { MENU_ITEM_HEIGHT, MENU_SUBMENU_ARROW_GLYPH } from '@/core/collection/menu/constants';
import type { MenuActionItemDefinition, MenuItemDefinition } from '@/core/collection/menu/types';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { buildMenuKindClassName, resolveMenuIcon, resolveMenuLabel } from './shared';

export interface ActionKindDescriptor extends ItemDescriptor {
  label: string;
  icon: React.ReactNode;
  hasSubmenu: boolean;
  isDisabled: boolean;
}

export interface ActionKindDOMRefs {
  jsxHostEl: HTMLDivElement;
  arrowEl: HTMLSpanElement;
}

function ActionRow({ label, icon }: ActionKindDescriptor) {
  return (
    <>
      {icon && <span className="menu-kind__icon material-symbols-outlined" aria-hidden="true">{icon}</span>}
      <span className="menu-kind__label">{label}</span>
    </>
  );
}

function isActionItem<TId extends ItemId>(item: MenuItemDefinition<TId>): item is MenuActionItemDefinition<TId> {
  return item.kind === 'action';
}

export interface ActionKindOptions {
  height?: number;
}

export function createActionKind<TId extends ItemId = ItemId>(
  options: ActionKindOptions = {}
): AnyRowKindDefinition<MenuItemDefinition<TId>, TId> {
  return {
    kind: 'action',
    height: options.height ?? MENU_ITEM_HEIGHT,
    computeDescriptor(item, id, runtime) {
      const fallback = String(id);
      const descriptor: ActionKindDescriptor = {
        label: resolveMenuLabel(item.label, fallback),
        icon: resolveMenuIcon(item.icon),
        hasSubmenu: isActionItem(item) ? Boolean(item.submenu) : false,
        isDisabled: runtime.isDisabled,
        className: buildMenuKindClassName('menu-kind--action', runtime),
      };

      return {
        ...descriptor,
        jsx: React.createElement(ActionRow, descriptor),
      } as JSXDescriptor;
    },
    create(container) {
      const jsxHostEl = document.createElement('div');
      jsxHostEl.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;gap:8px;';

      const arrowEl = document.createElement('span');
      arrowEl.className = 'menu-kind__arrow';
      arrowEl.style.display = 'none';
      arrowEl.textContent = MENU_SUBMENU_ARROW_GLYPH;

      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.appendChild(jsxHostEl);
      container.appendChild(arrowEl);

      return { jsxHostEl, arrowEl } satisfies ActionKindDOMRefs;
    },
    update(refs, descriptor: ActionKindDescriptor) {
      refs.arrowEl.style.display = descriptor.hasSubmenu ? '' : 'none';
    },
  };
}




