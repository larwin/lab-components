import React from 'react';
import { alignStyle } from './cell.utils';

export type GridCellAlign = 'left' | 'center' | 'right';

export interface TextCellDescriptor {
  value: string;
  className?: string;
  align?: GridCellAlign;
}

export function TextCell({ value, className, align = 'left' }: TextCellDescriptor) {
  return (
    <span
      className={className ? `grid-cell__value ${className}` : 'grid-cell__value'}
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        ...alignStyle(align, 'left'),
      }}
    >
      {value}
    </span>
  );
}



