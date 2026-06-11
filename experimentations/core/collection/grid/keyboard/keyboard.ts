import { getNextFocusableId, getPrevFocusableId } from '@/core/collection/shared/keyboard';

export interface GridCellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface GridKeyboardContext {
  rowCount: number;
  columnCount: number;
  focusedCell: GridCellPosition | null;
  disabledRowIndexes?: Set<number>;
  disabledColumnIndexes?: Set<number>;
}

function createRange(size: number): number[] {
  return Array.from({ length: Math.max(0, size) }, (_, index) => index);
}

function isRowFocusable(ctx: GridKeyboardContext, rowIndex: number): boolean {
  return !ctx.disabledRowIndexes?.has(rowIndex);
}

function isColumnFocusable(ctx: GridKeyboardContext, columnIndex: number): boolean {
  return !ctx.disabledColumnIndexes?.has(columnIndex);
}

function getFirstFocusableRow(ctx: GridKeyboardContext): number | null {
  return getNextFocusableId(createRange(ctx.rowCount), null, (rowIndex) => isRowFocusable(ctx, rowIndex));
}

function getLastFocusableRow(ctx: GridKeyboardContext): number | null {
  return getPrevFocusableId(createRange(ctx.rowCount), null, (rowIndex) => isRowFocusable(ctx, rowIndex));
}

function getFirstFocusableColumn(ctx: GridKeyboardContext): number | null {
  return getNextFocusableId(createRange(ctx.columnCount), null, (columnIndex) => isColumnFocusable(ctx, columnIndex));
}

function getLastFocusableColumn(ctx: GridKeyboardContext): number | null {
  return getPrevFocusableId(createRange(ctx.columnCount), null, (columnIndex) => isColumnFocusable(ctx, columnIndex));
}

function hasCells(ctx: GridKeyboardContext): boolean {
  return ctx.rowCount > 0 && ctx.columnCount > 0;
}

function isInsideBounds(rowIndex: number, columnIndex: number, ctx: GridKeyboardContext): boolean {
  return rowIndex >= 0 && rowIndex < ctx.rowCount && columnIndex >= 0 && columnIndex < ctx.columnCount;
}

function normalizeFocusedCell(ctx: GridKeyboardContext): GridCellPosition | null {
  if (!hasCells(ctx)) {
    return null;
  }

  const firstRow = getFirstFocusableRow(ctx);
  const firstColumn = getFirstFocusableColumn(ctx);
  if (firstRow == null || firstColumn == null) {
    return null;
  }

  if (ctx.focusedCell == null) {
    return { rowIndex: firstRow, columnIndex: firstColumn };
  }

  const { rowIndex, columnIndex } = ctx.focusedCell;
  if (!isInsideBounds(rowIndex, columnIndex, ctx)) {
    return { rowIndex: firstRow, columnIndex: firstColumn };
  }

  return {
    rowIndex: isRowFocusable(ctx, rowIndex) ? rowIndex : firstRow,
    columnIndex: isColumnFocusable(ctx, columnIndex) ? columnIndex : firstColumn,
  };
}

export function navigateCellRight(ctx: GridKeyboardContext): GridCellPosition | null {
  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const nextColumn = getNextFocusableId(
    createRange(ctx.columnCount),
    cell.columnIndex,
    (columnIndex) => isColumnFocusable(ctx, columnIndex),
  );

  if (nextColumn == null) {
    return null;
  }

  return {
    rowIndex: cell.rowIndex,
    columnIndex: nextColumn,
  };
}

export function navigateCellLeft(ctx: GridKeyboardContext): GridCellPosition | null {
  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const prevColumn = getPrevFocusableId(
    createRange(ctx.columnCount),
    cell.columnIndex,
    (columnIndex) => isColumnFocusable(ctx, columnIndex),
  );

  if (prevColumn == null) {
    return null;
  }

  return {
    rowIndex: cell.rowIndex,
    columnIndex: prevColumn,
  };
}

export function navigateCellDown(ctx: GridKeyboardContext): GridCellPosition | null {
  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const nextRow = getNextFocusableId(
    createRange(ctx.rowCount),
    cell.rowIndex,
    (rowIndex) => isRowFocusable(ctx, rowIndex),
  );

  if (nextRow == null) {
    return null;
  }

  return {
    rowIndex: nextRow,
    columnIndex: cell.columnIndex,
  };
}

export function navigateCellUp(ctx: GridKeyboardContext): GridCellPosition | null {
  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const prevRow = getPrevFocusableId(
    createRange(ctx.rowCount),
    cell.rowIndex,
    (rowIndex) => isRowFocusable(ctx, rowIndex),
  );

  if (prevRow == null) {
    return null;
  }

  return {
    rowIndex: prevRow,
    columnIndex: cell.columnIndex,
  };
}

export function navigateCellTab(ctx: GridKeyboardContext): GridCellPosition | null {
  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const right = navigateCellRight(ctx);
  if (right != null && right.columnIndex !== cell.columnIndex) {
    return right;
  }

  const nextRow = getNextFocusableId(
    createRange(ctx.rowCount),
    cell.rowIndex,
    (rowIndex) => isRowFocusable(ctx, rowIndex),
  );

  if (nextRow == null || nextRow === cell.rowIndex) {
    return cell;
  }

  const firstColumn = getFirstFocusableColumn(ctx);
  if (firstColumn == null) {
    return cell;
  }

  return { rowIndex: nextRow, columnIndex: firstColumn };
}

export function navigateCellShiftTab(ctx: GridKeyboardContext): GridCellPosition | null {
  if (ctx.focusedCell == null) {
    if (!hasCells(ctx)) {
      return null;
    }

    const lastRow = getLastFocusableRow(ctx);
    const lastColumn = getLastFocusableColumn(ctx);
    if (lastRow == null || lastColumn == null) {
      return null;
    }

    return { rowIndex: lastRow, columnIndex: lastColumn };
  }

  const cell = normalizeFocusedCell(ctx);
  if (cell == null) {
    return null;
  }

  const left = navigateCellLeft(ctx);
  if (left != null && left.columnIndex !== cell.columnIndex) {
    return left;
  }

  const prevRow = getPrevFocusableId(
    createRange(ctx.rowCount),
    cell.rowIndex,
    (rowIndex) => isRowFocusable(ctx, rowIndex),
  );

  if (prevRow == null || prevRow === cell.rowIndex) {
    return cell;
  }

  const lastColumn = getLastFocusableColumn(ctx);
  if (lastColumn == null) {
    return cell;
  }

  return { rowIndex: prevRow, columnIndex: lastColumn };
}

