import { describe, expect, it } from 'vitest';
import { PAGER_STEP_PX, dragSteps, growWindow, resizeWindow, shrinkWindow } from './columnWindow';

describe('resizeWindow', () => {
  it('widens the window from its end, then its start', () => {
    expect(resizeWindow({ first: 2, last: 3 }, 6, 'end', 1)).toEqual({ first: 2, last: 4 });
    expect(resizeWindow({ first: 2, last: 3 }, 6, 'start', -2)).toEqual({ first: 0, last: 3 });
  });

  it('grows up to every open column', () => {
    expect(resizeWindow({ first: 0, last: 1 }, 9, 'end', 100)).toEqual({ first: 0, last: 8 });
    expect(resizeWindow({ first: 3, last: 4 }, 9, 'start', -100)).toEqual({ first: 0, last: 4 });
  });

  it('keeps at least one column', () => {
    expect(resizeWindow({ first: 1, last: 3 }, 6, 'end', -10)).toEqual({ first: 1, last: 1 });
    expect(resizeWindow({ first: 1, last: 3 }, 6, 'start', 10)).toEqual({ first: 3, last: 3 });
  });
});

describe('dragSteps', () => {
  it('counts the boxes crossed, rounding to the nearest one', () => {
    expect(dragSteps(0)).toBe(0);
    expect(dragSteps(PAGER_STEP_PX * 0.6)).toBe(1);
    expect(dragSteps(-PAGER_STEP_PX * 2)).toBe(-2);
  });
});

describe('growWindow / shrinkWindow', () => {
  it('adds the level before the window, or after it at the root', () => {
    expect(growWindow({ first: 2, last: 3 }, 4)).toEqual({ first: 1, last: 3 });
    expect(growWindow({ first: 0, last: 1 }, 4)).toEqual({ first: 0, last: 2 });
    expect(growWindow({ first: 0, last: 3 }, 4)).toEqual({ first: 0, last: 3 });
  });

  it('drops the leftmost column, down to one', () => {
    expect(shrinkWindow({ first: 1, last: 3 }, 4)).toEqual({ first: 2, last: 3 });
    expect(shrinkWindow({ first: 3, last: 3 }, 4)).toEqual({ first: 3, last: 3 });
  });
});
