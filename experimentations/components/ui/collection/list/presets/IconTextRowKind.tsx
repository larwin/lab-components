import React from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { ItemDescriptor } from '@/core/collection/list/kind/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createJSXKind } from '../kind/jsx-kind';

interface IconTextDescriptor extends ItemDescriptor {
  label: string;
  icon?: React.ReactNode;
}

function IconTextRow({ label, icon }: IconTextDescriptor) {
  return (
    <div className="list-preset-icon-text">
      {icon && <span className="list-preset-icon-text__icon">{icon}</span>}
      <span className="list-preset-icon-text__label">{label}</span>
    </div>
  );
}

export interface IconTextKindOptions<TItem> {
  getLabel: (item: TItem, runtime: ItemRuntime) => string;
  getIcon?: (item: TItem, runtime: ItemRuntime) => React.ReactNode | undefined;
  height?: number;
}

export function createIconTextKind<TItem, TId extends ItemId = ItemId>(
  options: IconTextKindOptions<TItem>
): AnyRowKindDefinition<TItem, TId> {
  return createJSXKind<TItem, TId, IconTextDescriptor>({
    kind: 'icon-text',
    height: options.height ?? LIST_DEFAULT_ITEM_HEIGHT,
    computeDescriptor(item, _id, runtime) {
      return {
        label: options.getLabel(item, runtime),
        icon: options.getIcon?.(item, runtime),
      };
    },
    Component: IconTextRow,
  });
}




