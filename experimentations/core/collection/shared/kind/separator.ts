import type { Culture } from '@/core/culture';
import type { ItemId, ItemRuntime } from '../runtime';
import type { ItemDescriptor, RowKindDefinition } from './types';

export interface SeparatorDOMRefs {
  lineEl: HTMLHRElement;
}

export class RowKindSeparatorDefinition<
  TItem = unknown,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, ItemDescriptor, SeparatorDOMRefs> {
  readonly kind = 'separator';
  readonly height = 1;

  computeDescriptor(_item: TItem, _id: TId, _runtime: TRuntime, _culture?: Culture): ItemDescriptor {
    return {};
  }

  create(container: HTMLElement): SeparatorDOMRefs {
    const lineEl = document.createElement('hr');
    lineEl.className = 'list-kind-separator';
    lineEl.setAttribute('aria-hidden', 'true');
    lineEl.style.margin = '0';
    container.appendChild(lineEl);

    return { lineEl };
  }

  update(_refs: SeparatorDOMRefs, _descriptor: ItemDescriptor): void {
    // Separator is static by design.
  }
}
