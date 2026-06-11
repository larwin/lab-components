import React from 'react';
import type { Culture } from '@/core/culture';
import type { GridCellAlign } from './TextCellKind';
import { alignStyle } from './cell.utils';

export interface NumberCellDescriptor {
  value: number | null;
  formatted: string;
  align?: GridCellAlign;
}

export function formatNumberCellValue(value: number | null, culture?: Culture): string {
  if (value == null || Number.isNaN(value)) {
    return '';
  }
  return culture?.format.number(value) ?? String(value);
}

export function NumberCell({ formatted, align = 'right' }: NumberCellDescriptor) {
  return (
    <span
      className="grid-cell__value"
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        ...alignStyle(align, 'right'),
      }}
    >
      {formatted}
    </span>
  );
}



