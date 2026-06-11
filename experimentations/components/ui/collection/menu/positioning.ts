import { MENU_SAFE_MARGIN, MENU_SUBMENU_GAP } from '@/core/collection/menu/constants';

export interface MenuPoint {
  x: number;
  y: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface RootPlacementInput {
  point: { x: number; y: number };
  menuSize: MenuSize;
  viewport: ViewportSize;
  safeMargin?: number;
}

export interface AxisClampResult {
  value: number;
  clamped: boolean;
}

export interface RootPlacementResult {
  left: number;
  top: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  fitsHorizontally: boolean;
  fitsVertically: boolean;
  clampedX: boolean;
  clampedY: boolean;
}

export type SubmenuHorizontalSide = 'right' | 'left';

export interface RectLike {
  left: number;
  top: number;
  right: number;
}

export interface SubmenuPlacementInput {
  parentItemRect: RectLike;
  menuSize: MenuSize;
  viewport: ViewportSize;
  safeMargin?: number;
  submenuGap?: number;
}

export interface SubmenuPlacementResult extends RootPlacementResult {
  horizontalSide: SubmenuHorizontalSide;
  flippedHorizontally: boolean;
}

export const MENU_POSITIONING_DEFAULTS = {
  safeMargin: MENU_SAFE_MARGIN,
  submenuGap: MENU_SUBMENU_GAP,
  fallbackSize: {
    width: 280,
    height: 240,
  },
} as const;

function sanitizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampToViewport(
  position: number,
  size: number,
  viewportSize: number,
  safeMargin: number,
): AxisClampResult {
  const normalizedViewport = Math.max(0, sanitizeNumber(viewportSize));
  const normalizedSize = Math.max(0, sanitizeNumber(size));
  const normalizedMargin = Math.max(0, sanitizeNumber(safeMargin));
  const min = normalizedMargin;
  const max = normalizedViewport - normalizedMargin - normalizedSize;

  if (max < min) {
    return {
      value: min,
      clamped: true,
    };
  }

  const nextValue = clamp(sanitizeNumber(position), min, max);
  return {
    value: nextValue,
    clamped: nextValue !== position,
  };
}

export function computeRootPlacement({
  point,
  menuSize,
  viewport,
  safeMargin = MENU_POSITIONING_DEFAULTS.safeMargin,
}: RootPlacementInput): RootPlacementResult {
  const normalizedMargin = Math.max(0, sanitizeNumber(safeMargin));
  const viewportWidth = Math.max(0, sanitizeNumber(viewport.width));
  const viewportHeight = Math.max(0, sanitizeNumber(viewport.height));
  const availableWidth = Math.max(0, viewportWidth - normalizedMargin * 2);
  const availableHeight = Math.max(0, viewportHeight - normalizedMargin * 2);
  const requestedWidth = Math.max(0, sanitizeNumber(menuSize.width));
  const requestedHeight = Math.max(0, sanitizeNumber(menuSize.height));
  const width = Math.min(requestedWidth, availableWidth);
  const height = Math.min(requestedHeight, availableHeight);
  const clampX = clampToViewport(point.x, width, viewportWidth, normalizedMargin);
  const clampY = clampToViewport(point.y, height, viewportHeight, normalizedMargin);

  return {
    left: clampX.value,
    top: clampY.value,
    width,
    height,
    maxWidth: availableWidth,
    maxHeight: availableHeight,
    fitsHorizontally: requestedWidth <= availableWidth,
    fitsVertically: requestedHeight <= availableHeight,
    clampedX: clampX.clamped,
    clampedY: clampY.clamped,
  };
}

export function computeSubmenuPlacement({
  parentItemRect,
  menuSize,
  viewport,
  safeMargin = MENU_POSITIONING_DEFAULTS.safeMargin,
  submenuGap = MENU_POSITIONING_DEFAULTS.submenuGap,
}: SubmenuPlacementInput): SubmenuPlacementResult {
  const normalizedMargin = Math.max(0, sanitizeNumber(safeMargin));
  const viewportWidth = Math.max(0, sanitizeNumber(viewport.width));
  const viewportHeight = Math.max(0, sanitizeNumber(viewport.height));
  const availableWidth = Math.max(0, viewportWidth - normalizedMargin * 2);
  const availableHeight = Math.max(0, viewportHeight - normalizedMargin * 2);
  const requestedWidth = Math.max(0, sanitizeNumber(menuSize.width));
  const requestedHeight = Math.max(0, sanitizeNumber(menuSize.height));
  const width = Math.min(requestedWidth, availableWidth);
  const height = Math.min(requestedHeight, availableHeight);
  const gap = Math.max(0, sanitizeNumber(submenuGap));
  const parentLeft = sanitizeNumber(parentItemRect.left);
  const parentRight = sanitizeNumber(parentItemRect.right);
  const rightLeft = parentRight + gap;
  const leftLeft = parentLeft - gap - width;
  const rightOverflow = Math.max(0, rightLeft + width - (viewportWidth - normalizedMargin));
  const leftOverflow = Math.max(0, normalizedMargin - leftLeft);
  const shouldFlip = rightOverflow > 0 && leftOverflow < rightOverflow;
  const requestedLeft = shouldFlip ? leftLeft : rightLeft;
  const requestedTop = sanitizeNumber(parentItemRect.top);
  const clampX = clampToViewport(requestedLeft, width, viewportWidth, normalizedMargin);
  const clampY = clampToViewport(requestedTop, height, viewportHeight, normalizedMargin);

  return {
    left: clampX.value,
    top: clampY.value,
    width,
    height,
    maxWidth: availableWidth,
    maxHeight: availableHeight,
    fitsHorizontally: requestedWidth <= availableWidth,
    fitsVertically: requestedHeight <= availableHeight,
    clampedX: clampX.clamped,
    clampedY: clampY.clamped,
    horizontalSide: shouldFlip ? 'left' : 'right',
    flippedHorizontally: shouldFlip,
  };
}



