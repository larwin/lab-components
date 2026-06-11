import React from 'react';
import type { AvailableActions } from '@/core/collection/grid/definition/actions';
import { GRID_DEFAULT_ROW_HEIGHT } from '@/core/collection/grid/constants';
import type { ColumnDef } from '@/core/collection/grid/definition/column';
import type { CellDescriptor } from '@/core/collection/grid/kind/cell';
import type { Culture } from '@/core/culture';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { createJSXKind } from '@/components/ui/collection/virtual/kind/jsx-kind';
import { GRID_HIERARCHY_INDENT_PX } from '../constants';
import { NumberCell, formatNumberCellValue } from './NumberCellKind';
import { TextCell, type GridCellAlign } from './TextCellKind';

function buildRuntimeClassName(runtime: ItemRuntime): string {
  const classes = ['grid-row', 'grid-row--cellular'];
  if (runtime.isSelected) classes.push('is-selected');
  if (runtime.isFocused) classes.push('is-focused');
  if (runtime.isDisabled) classes.push('is-disabled');
  return classes.join(' ');
}

function isAvailableActions(value: unknown): value is AvailableActions {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as AvailableActions;
  return candidate.row == null || Array.isArray(candidate.row);
}

function actionGlyph(actionId: string): string {
  switch (actionId) {
    case 'edit':
      return 'edit';
    case 'delete':
      return 'delete';
    case 'more':
      return 'more_horiz';
    default:
      return 'more_horiz';
  }
}

function toTextValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function asAlign(align?: string): GridCellAlign {
  if (align === 'center' || align === 'right') {
    return align;
  }
  return 'left';
}

function ActionCell({ value }: { value: AvailableActions | undefined }) {
  const rowActions = value?.row ?? [];

  return (
    <span className="grid-cell__value inline-flex items-center gap-2">
      {rowActions.map((actionId) => (
        <button
          key={actionId}
          type="button"
          data-grid-action={actionId}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/80 hover:text-foreground"
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 18,
              lineHeight: 1,
              fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24',
              pointerEvents: 'none',
            }}
          >
            {actionGlyph(actionId)}
          </span>
        </button>
      ))}
    </span>
  );
}

export interface CellularRowDescriptor extends ItemDescriptor {
  cells: CellDescriptor[];
}

function CellularRow({ cells }: CellularRowDescriptor) {
  return (
    <div style={{ display: 'contents' }}>
      {cells.map((cell) => (
        <div
          key={cell.columnId}
          className={cell.className ? `grid-cell ${cell.className}` : 'grid-cell'}
          style={cell.style as React.CSSProperties | undefined}
          data-column-id={cell.columnId}
        >
          {cell.displayValue as React.ReactNode}
        </div>
      ))}
    </div>
  );
}

function toCellDisplayValue(
  kind: string,
  align: GridCellAlign,
  value: unknown,
  displayValue: unknown,
  culture?: Culture
): React.ReactNode {
  if (isAvailableActions(displayValue)) {
    return <ActionCell value={displayValue} />;
  }

  if (kind === 'number') {
    const numericValue = typeof value === 'number' ? value : null;
    const formatted = typeof displayValue === 'string'
      ? displayValue
      : formatNumberCellValue(numericValue, culture);
    return <NumberCell value={numericValue} formatted={formatted} align={align === 'left' ? 'left' : align} />;
  }

  return <TextCell value={toTextValue(displayValue)} align={align} />;
}

export interface CreateCellularKindOptions {
  height?: number;
  kind?: string;
  extends?: string;
  culture?: Culture;
}

export function createCellularKind<TItem, TId extends ItemId = ItemId>(
  columns: Array<ColumnDef<TItem, TId>>,
  options: CreateCellularKindOptions = {}
): AnyRowKindDefinition<TItem, TId> {
  return createJSXKind<TItem, TId, CellularRowDescriptor>({
    kind: options.kind ?? 'cellular',
    height: options.height ?? GRID_DEFAULT_ROW_HEIGHT,
    extends: options.extends,
    computeDescriptor(item, id, runtime, culture) {
      const activeCulture = (culture as Culture | undefined) ?? options.culture;

      return {
        className: buildRuntimeClassName(runtime),
        cells: columns.map((column) => {
          const value = column.cell.getValue(item, id, runtime, activeCulture);
          const baseDisplayValue = column.cell.getDisplay?.(item, id, runtime, value, activeCulture) ?? value;
          const baseStyle = column.cell.getStyle?.(item, id, runtime, value, baseDisplayValue, activeCulture);
          const align = asAlign(column.view.align);

          let style = baseStyle;
          let displayValue = toCellDisplayValue(column.kind, align, value, baseDisplayValue, activeCulture);

          if (column.cell.isHierarchyColumn) {
            style = {
              ...(baseStyle ?? {}),
              paddingLeft: `${Math.max(0, runtime.hierarchy.depth) * GRID_HIERARCHY_INDENT_PX}px`,
            };

            if (runtime.isExpandable) {
              const glyph = runtime.isExpanded ? '\u25BC' : '\u25B6';
              const content = toTextValue(baseDisplayValue);
              displayValue = <TextCell value={`${glyph} ${content}`} align={align} />;
            }
          }

          return {
            columnId: column.cell.columnId,
            value,
            displayValue,
            className: column.cell.getClassName?.(item, id, runtime, value, baseDisplayValue, activeCulture),
            style,
          } satisfies CellDescriptor;
        }),
      };
    },
    Component: CellularRow,
  });
}

