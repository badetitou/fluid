import { describe, expect, it } from 'vitest';
import { BOX } from './classLayout';
import { scrollToBox } from './useScrollToClass';

describe('scrollToBox', () => {
  it('centres a box far to the right, its top just in view', () => {
    expect(scrollToBox({ x: 1500, y: 40 }, 700)).toEqual({ left: 1500 + BOX.width / 2 - 350, top: 16 });
  });

  it('never scrolls before the start of the plane', () => {
    expect(scrollToBox({ x: 10, y: 0 }, 700)).toEqual({ left: 0, top: 0 });
  });
});
