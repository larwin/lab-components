import { describe, expect, it } from 'vitest';
import {
  navigateCellDown,
  navigateCellLeft,
  navigateCellRight,
  navigateCellShiftTab,
  navigateCellTab,
  navigateCellUp,
  type GridKeyboardContext,
} from '../keyboard';

function createContext(overrides?: Partial<GridKeyboardContext>): GridKeyboardContext {
  return {
    rowCount: 3,
    columnCount: 4,
    focusedCell: { rowIndex: 1, columnIndex: 1 },
    ...overrides,
  };
}

describe('grid keyboard navigation', () => {
  it('moves right and left within row boundaries', () => {
    expect(navigateCellRight(createContext())).toEqual({ rowIndex: 1, columnIndex: 2 });
    expect(navigateCellLeft(createContext())).toEqual({ rowIndex: 1, columnIndex: 0 });
  });

  it('moves up and down within column boundaries', () => {
    expect(navigateCellDown(createContext())).toEqual({ rowIndex: 2, columnIndex: 1 });
    expect(navigateCellUp(createContext())).toEqual({ rowIndex: 0, columnIndex: 1 });
  });

  it('does not overflow row/column bounds', () => {
    const topLeft = createContext({ focusedCell: { rowIndex: 0, columnIndex: 0 } });
    const bottomRight = createContext({ focusedCell: { rowIndex: 2, columnIndex: 3 } });

    expect(navigateCellLeft(topLeft)).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(navigateCellUp(topLeft)).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(navigateCellRight(bottomRight)).toEqual({ rowIndex: 2, columnIndex: 3 });
    expect(navigateCellDown(bottomRight)).toEqual({ rowIndex: 2, columnIndex: 3 });
  });

  it('Tab moves to next column and wraps to next row', () => {
    const center = createContext({ focusedCell: { rowIndex: 1, columnIndex: 1 } });
    const rowEnd = createContext({ focusedCell: { rowIndex: 1, columnIndex: 3 } });
    const gridEnd = createContext({ focusedCell: { rowIndex: 2, columnIndex: 3 } });

    expect(navigateCellTab(center)).toEqual({ rowIndex: 1, columnIndex: 2 });
    expect(navigateCellTab(rowEnd)).toEqual({ rowIndex: 2, columnIndex: 0 });
    expect(navigateCellTab(gridEnd)).toEqual({ rowIndex: 2, columnIndex: 3 });
  });

  it('Shift+Tab moves to previous column and wraps to previous row', () => {
    const center = createContext({ focusedCell: { rowIndex: 1, columnIndex: 2 } });
    const rowStart = createContext({ focusedCell: { rowIndex: 1, columnIndex: 0 } });
    const gridStart = createContext({ focusedCell: { rowIndex: 0, columnIndex: 0 } });

    expect(navigateCellShiftTab(center)).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(navigateCellShiftTab(rowStart)).toEqual({ rowIndex: 0, columnIndex: 3 });
    expect(navigateCellShiftTab(gridStart)).toEqual({ rowIndex: 0, columnIndex: 0 });
  });

  it('returns first cell when focus is missing', () => {
    const ctx = createContext({ focusedCell: null });
    expect(navigateCellRight(ctx)).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(navigateCellDown(ctx)).toEqual({ rowIndex: 1, columnIndex: 0 });
    expect(navigateCellTab(ctx)).toEqual({ rowIndex: 0, columnIndex: 1 });
  });

  it('supports disabled rows and columns', () => {
    const ctx = createContext({
      focusedCell: { rowIndex: 1, columnIndex: 1 },
      disabledRowIndexes: new Set([2]),
      disabledColumnIndexes: new Set([2]),
    });

    expect(navigateCellRight(ctx)).toEqual({ rowIndex: 1, columnIndex: 3 });
    expect(navigateCellDown(ctx)).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(navigateCellTab(ctx)).toEqual({ rowIndex: 1, columnIndex: 3 });
  });

  it('returns null when the grid has no focusable cell', () => {
    const empty = createContext({ rowCount: 0, columnCount: 3, focusedCell: null });
    const noColumn = createContext({ rowCount: 2, columnCount: 0, focusedCell: null });
    const allRowsDisabled = createContext({
      focusedCell: null,
      disabledRowIndexes: new Set([0, 1, 2]),
    });
    const allColumnsDisabled = createContext({
      focusedCell: null,
      disabledColumnIndexes: new Set([0, 1, 2, 3]),
    });

    expect(navigateCellRight(empty)).toBeNull();
    expect(navigateCellRight(noColumn)).toBeNull();
    expect(navigateCellTab(allRowsDisabled)).toBeNull();
    expect(navigateCellShiftTab(allColumnsDisabled)).toBeNull();
  });
});

