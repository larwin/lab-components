import { describe, expect, it } from 'vitest';
import { computeRootPlacement, computeSubmenuPlacement } from '../positioning';

describe('menu positioning', () => {
  it('clamps root placement to safe margins', () => {
    const placement = computeRootPlacement({
      point: { x: 760, y: 560 },
      menuSize: { width: 200, height: 120 },
      viewport: { width: 800, height: 600 },
      safeMargin: 8,
    });

    expect(placement.left).toBe(592);
    expect(placement.top).toBe(472);
    expect(placement.clampedX).toBe(true);
    expect(placement.clampedY).toBe(true);
  });

  it('opens submenu on the preferred right side when space is available', () => {
    const placement = computeSubmenuPlacement({
      parentItemRect: {
        left: 100,
        top: 40,
        right: 220,
      },
      menuSize: { width: 200, height: 160 },
      viewport: { width: 1280, height: 720 },
      safeMargin: 8,
      submenuGap: 2,
    });

    expect(placement.horizontalSide).toBe('right');
    expect(placement.flippedHorizontally).toBe(false);
    expect(placement.left).toBe(222);
    expect(placement.top).toBe(40);
  });

  it('flips submenu to the left and clamps vertically when needed', () => {
    const placement = computeSubmenuPlacement({
      parentItemRect: {
        left: 760,
        top: 590,
        right: 780,
      },
      menuSize: { width: 200, height: 120 },
      viewport: { width: 800, height: 600 },
      safeMargin: 8,
      submenuGap: 2,
    });

    expect(placement.horizontalSide).toBe('left');
    expect(placement.flippedHorizontally).toBe(true);
    expect(placement.left).toBe(558);
    expect(placement.top).toBe(472);
  });
});



