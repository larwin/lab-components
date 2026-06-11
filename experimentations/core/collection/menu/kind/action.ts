import type { Culture } from '@/core/culture';
import type { ItemDescriptor, RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

export interface ActionKindDescriptor extends ItemDescriptor {
  label: string;
  icon: string | null;
  hasSubmenu: boolean;
  isDisabled: boolean;
  isFocused: boolean;
}

export interface ActionKindDOMRefs {
  rootEl: HTMLDivElement;
  iconEl: HTMLSpanElement;
  labelEl: HTMLSpanElement;
  arrowEl: HTMLSpanElement;
}

export interface ActionKindOptions<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  height: number;
  getLabel: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string;
  getIcon?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string | null | undefined;
  hasSubmenu?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => boolean;
}

export class RowKindActionDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, ActionKindDescriptor, ActionKindDOMRefs> {
  readonly kind = 'action';
  readonly height: number;

  constructor(private readonly options: ActionKindOptions<TItem, TId, TRuntime>) {
    this.height = options.height;
  }

  computeDescriptor(item: TItem, id: TId, runtime: TRuntime, culture?: Culture): ActionKindDescriptor {
    const classes = ['menu-kind', 'menu-kind--action'];
    if (runtime.isFocused) classes.push('is-focused');
    if (runtime.isSelected) classes.push('is-selected');
    if (runtime.isDisabled) classes.push('is-disabled');

    return {
      label: this.options.getLabel(item, id, runtime, culture),
      icon: this.options.getIcon?.(item, id, runtime, culture) ?? null,
      hasSubmenu: this.options.hasSubmenu?.(item, id, runtime, culture) ?? false,
      isDisabled: runtime.isDisabled,
      isFocused: runtime.isFocused,
      className: classes.join(' '),
    };
  }

  create(container: HTMLElement): ActionKindDOMRefs {
    const rootEl = document.createElement('div');
    rootEl.className = 'menu-kind menu-kind--action';

    const iconEl = document.createElement('span');
    iconEl.className = 'menu-kind__icon';

    const labelEl = document.createElement('span');
    labelEl.className = 'menu-kind__label';

    const arrowEl = document.createElement('span');
    arrowEl.className = 'menu-kind__arrow';

    rootEl.appendChild(iconEl);
    rootEl.appendChild(labelEl);
    rootEl.appendChild(arrowEl);
    container.appendChild(rootEl);

    return {
      rootEl,
      iconEl,
      labelEl,
      arrowEl,
    };
  }

  update(refs: ActionKindDOMRefs, descriptor: ActionKindDescriptor): void {
    refs.rootEl.className = descriptor.className ?? 'menu-kind menu-kind--action';
    refs.labelEl.textContent = descriptor.label;
    refs.iconEl.textContent = descriptor.icon ?? '';
    refs.arrowEl.textContent = descriptor.hasSubmenu ? '>' : '';

    if (descriptor.style) {
      Object.assign(refs.rootEl.style, descriptor.style);
    }
  }
}



