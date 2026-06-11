import type { Culture } from '@/core/culture';
import type { ItemDescriptor, KindHostElement, RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { AvailableActions } from '../definition/actions';
import type { CellDescriptor, CellKindDefinition } from './cell';

export interface CellularDescriptor extends ItemDescriptor {
  cells: CellDescriptor[];
}

export interface CellularDOMRefs {
  contentEl: HTMLDivElement;
  cellEls: HTMLDivElement[];
  valueEls: HTMLSpanElement[];
}

const HIERARCHY_INDENT_PX = 16;

function buildRuntimeClassName(runtime: ItemRuntime): string {
  const classes = ['grid-row', 'grid-row--cellular'];
  if (runtime.isSelected) classes.push('is-selected');
  if (runtime.isFocused) classes.push('is-focused');
  if (runtime.isDisabled) classes.push('is-disabled');
  return classes.join(' ');
}

function applyCellStyle(cellEl: HTMLDivElement, style?: Partial<CSSStyleDeclaration>) {
  cellEl.style.cssText = '';
  if (!style) return;
  Object.assign(cellEl.style, style);
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

function renderActionCell(
  valueEl: HTMLSpanElement,
  value: AvailableActions | undefined,
  doc: Document
): void {
  valueEl.textContent = '';
  valueEl.className = 'grid-cell__value inline-flex items-center gap-2';

  const rowActions = value?.row ?? [];
  for (const actionId of rowActions) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.gridAction = actionId;
    button.className = [
      'inline-flex h-7 w-7 items-center justify-center rounded-md',
      'text-muted-foreground transition-all duration-150',
      'hover:-translate-y-px hover:bg-accent/80 hover:text-foreground hover:shadow-sm',
    ].join(' ');
    button.style.cssText = 'border:none;background:transparent;padding:0;cursor:pointer;flex-shrink:0;';

    const icon = doc.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.cssText =
      'font-size:18px;line-height:1;font-variation-settings:"FILL" 0,"wght" 400,"GRAD" 0,"opsz" 24;pointer-events:none;';
    icon.textContent = actionGlyph(actionId);

    button.appendChild(icon);
    valueEl.appendChild(button);
  }
}

export class RowKindCellularDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, CellularDescriptor, CellularDOMRefs> {
  readonly kind = 'cellular';
  readonly height: number;

  private readonly cells: Array<CellKindDefinition<TItem, TId, TRuntime>>;

  constructor(options: { cells: Array<CellKindDefinition<TItem, TId, TRuntime>>; height: number }) {
    this.cells = options.cells;
    this.height = options.height;
  }

  computeDescriptor(item: TItem, id: TId, runtime: TRuntime, culture?: Culture): CellularDescriptor {
    return {
      className: buildRuntimeClassName(runtime),
      cells: this.cells.map((cellDef) => {
        const value = cellDef.getValue(item, id, runtime, culture);
        const baseDisplayValue = cellDef.getDisplay?.(item, id, runtime, value, culture) ?? value;
        const baseStyle = cellDef.getStyle?.(item, id, runtime, value, baseDisplayValue, culture);

        let displayValue = baseDisplayValue;
        let style = baseStyle;

        if (cellDef.isHierarchyColumn) {
          style = {
            ...(baseStyle ?? {}),
            paddingLeft: `${Math.max(0, runtime.hierarchy.depth) * HIERARCHY_INDENT_PX}px`,
          };

          if (runtime.isExpandable) {
            const glyph = runtime.isExpanded ? '\u25BC' : '\u25B6';
            displayValue = `${glyph} ${String(baseDisplayValue ?? '')}`;
          }
        }

        return {
          columnId: cellDef.columnId,
          value,
          displayValue,
          className: cellDef.getClassName?.(item, id, runtime, value, displayValue, culture),
          style,
        };
      }),
    };
  }

  create(container: KindHostElement): CellularDOMRefs {
    const doc = container.ownerDocument ?? document;
    const contentEl = doc.createElement('div');
    contentEl.className = 'grid-row grid-row--cellular';
    contentEl.style.display = 'flex';
    contentEl.style.minWidth = '100%';

    const cellEls: HTMLDivElement[] = [];
    const valueEls: HTMLSpanElement[] = [];

    for (const cellDef of this.cells) {
      const cellEl = doc.createElement('div');
      cellEl.className = 'grid-cell';
      cellEl.dataset.columnId = cellDef.columnId;

      const valueEl = doc.createElement('span');
      valueEl.className = 'grid-cell__value';
      valueEl.style.overflow = 'hidden';
      valueEl.style.textOverflow = 'ellipsis';
      valueEl.style.whiteSpace = 'nowrap';

      cellEl.appendChild(valueEl);
      contentEl.appendChild(cellEl);
      cellEls.push(cellEl);
      valueEls.push(valueEl);
    }

    container.appendChild(contentEl);

    return {
      contentEl,
      cellEls,
      valueEls,
    };
  }

  update(refs: CellularDOMRefs, descriptor: CellularDescriptor): void {
    refs.contentEl.className = descriptor.className ?? 'grid-row grid-row--cellular';
    if (descriptor.style) {
      Object.assign(refs.contentEl.style, descriptor.style);
    }

    for (let index = 0; index < refs.cellEls.length; index++) {
      const cellEl = refs.cellEls[index];
      const valueEl = refs.valueEls[index];
      const cell = descriptor.cells[index];

      if (!cell) {
        cellEl.style.display = 'none';
        valueEl.textContent = '';
        continue;
      }

      cellEl.style.display = '';
      cellEl.className = cell.className ? `grid-cell ${cell.className}` : 'grid-cell';
      applyCellStyle(cellEl, cell.style);
      if (isAvailableActions(cell.displayValue)) {
        renderActionCell(valueEl, cell.displayValue, refs.contentEl.ownerDocument ?? document);
      } else {
        valueEl.className = 'grid-cell__value';
        valueEl.textContent = String(cell.displayValue ?? '');
      }
    }
  }
}

