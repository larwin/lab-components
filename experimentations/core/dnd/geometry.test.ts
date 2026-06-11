import { describe, expect, it } from 'vitest';
import { hitTestRectsX, hitTestRectsY } from './geometry';

describe('hitTestRectsX', () => {
  const rects = [
    { key: 'col-a', left: 0, right: 100 },
    { key: 'col-b', left: 100, right: 200 },
  ];

  it('extends the drop zone before the first rect and after the last rect', () => {
    expect(hitTestRectsX({ x: -1, rects })).toEqual({
      targetKey: 'col-a',
      zone: 'before',
    });
    expect(hitTestRectsX({ x: 201, rects })).toEqual({
      targetKey: 'col-b',
      zone: 'after',
    });
  });

  it('returns none when there are no rects', () => {
    expect(hitTestRectsX({ x: 10, rects: [] })).toEqual({ zone: 'none' });
  });

  it('returns before when the pointer is in the first half of a rect', () => {
    expect(hitTestRectsX({ x: 25, rects })).toEqual({
      targetKey: 'col-a',
      zone: 'before',
    });
  });

  it('returns after when the pointer is in the second half of a rect', () => {
    expect(hitTestRectsX({ x: 75, rects })).toEqual({
      targetKey: 'col-a',
      zone: 'after',
    });
  });

  it('treats the midpoint as after', () => {
    expect(hitTestRectsX({ x: 50, rects })).toEqual({
      targetKey: 'col-a',
      zone: 'after',
    });
  });

  it('resolves the matching rect when the pointer is on a shared boundary', () => {
    expect(hitTestRectsX({ x: 100, rects })).toEqual({
      targetKey: 'col-a',
      zone: 'after',
    });
  });
});

describe('hitTestRectsY', () => {
  const rects = [
    { key: 'row-a', top: 0, bottom: 40 },
    { key: 'row-b', top: 40, bottom: 80 },
  ];

  it('returns none when the pointer is outside all rects', () => {
    expect(hitTestRectsY({ y: -1, rects })).toEqual({ zone: 'none' });
    expect(hitTestRectsY({ y: 81, rects })).toEqual({ zone: 'none' });
  });

  it('returns before when the pointer is in the first half of a rect', () => {
    expect(hitTestRectsY({ y: 10, rects })).toEqual({
      targetKey: 'row-a',
      zone: 'before',
    });
  });

  it('returns after when the pointer is in the second half of a rect', () => {
    expect(hitTestRectsY({ y: 30, rects })).toEqual({
      targetKey: 'row-a',
      zone: 'after',
    });
  });

  it('treats the midpoint as after', () => {
    expect(hitTestRectsY({ y: 20, rects })).toEqual({
      targetKey: 'row-a',
      zone: 'after',
    });
  });

  it('resolves the matching rect when the pointer is on a shared boundary', () => {
    expect(hitTestRectsY({ y: 40, rects })).toEqual({
      targetKey: 'row-a',
      zone: 'after',
    });
  });
});
