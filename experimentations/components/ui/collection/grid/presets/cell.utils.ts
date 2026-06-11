import type React from 'react';
import type { GridCellAlign } from './TextCellKind';

export function alignStyle(
  align: GridCellAlign | undefined,
  defaultAlign: GridCellAlign = 'left'
): React.CSSProperties {
  const resolved = align ?? defaultAlign;
  return { textAlign: resolved };
}



