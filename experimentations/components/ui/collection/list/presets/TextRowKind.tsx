import React from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { ItemDescriptor } from '@/core/collection/list/kind/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createJSXKind } from '../kind/jsx-kind';

interface TextDescriptor extends ItemDescriptor {
  label: string;
  sublabel?: string;
}

function TextRow({ label, sublabel }: TextDescriptor) {
  return (
    <div className="list-preset-text">
      <span className="list-preset-text__label">{label}</span>
      {sublabel && <span className="list-preset-text__sublabel">{sublabel}</span>}
    </div>
  );
}

export interface TextKindOptions<TItem> {
  getLabel: (item: TItem, runtime: ItemRuntime) => string;
  getSublabel?: (item: TItem, runtime: ItemRuntime) => string | undefined;
  height?: number;
}

export function createTextKind<TItem, TId extends ItemId = ItemId>(
  options: TextKindOptions<TItem>
): AnyRowKindDefinition<TItem, TId> {
  return createJSXKind<TItem, TId, TextDescriptor>({
    kind: 'text',
    height: options.height ?? LIST_DEFAULT_ITEM_HEIGHT,
    computeDescriptor(item, _id, runtime) {
      return {
        label: options.getLabel(item, runtime),
        sublabel: options.getSublabel?.(item, runtime),
      };
    },
    Component: TextRow,
  });
}




