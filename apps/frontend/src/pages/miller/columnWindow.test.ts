import { describe, expect, it } from 'vitest';
import { PAGER_STEP_PX as STEP, dragWindow, frameOf, moveWindow, resizeWindow } from './columnWindow';

describe('resizeWindow', () => {
  it('widens the window from its end, then its start', () => {
    expect(resizeWindow({ first: 2, last: 3 }, 6, 'end', 1)).toEqual({ first: 2, last: 4 });
    expect(resizeWindow({ first: 2, last: 3 }, 6, 'start', -2)).toEqual({ first: 0, last: 3 });
  });

  it('grows up to every open column and keeps at least one', () => {
    expect(resizeWindow({ first: 0, last: 1 }, 9, 'end', 100)).toEqual({ first: 0, last: 8 });
    expect(resizeWindow({ first: 1, last: 3 }, 6, 'end', -10)).toEqual({ first: 1, last: 1 });
    expect(resizeWindow({ first: 1, last: 3 }, 6, 'start', 10)).toEqual({ first: 3, last: 3 });
  });
});

describe('moveWindow', () => {
  it('slides the window without leaving the open columns', () => {
    expect(moveWindow({ first: 1, last: 2 }, 5, 1)).toEqual({ first: 2, last: 3 });
    expect(moveWindow({ first: 1, last: 2 }, 5, 10)).toEqual({ first: 3, last: 4 });
    expect(moveWindow({ first: 1, last: 2 }, 5, -10)).toEqual({ first: 0, last: 1 });
  });
});

describe('dragWindow', () => {
  const start = { first: 1, last: 2 };

  it('moves the frame with the pointer and snaps the window to the nearest columns', () => {
    const { frame, window } = dragWindow(start, 6, 'move', STEP * 1.4);
    expect(frame).toEqual({ left: STEP * 2.4, right: STEP * 4.4 });
    expect(window).toEqual({ first: 2, last: 3 });
  });

  it('keeps the frame inside the pager', () => {
    expect(dragWindow(start, 6, 'move', -1000).frame).toEqual(frameOf({ first: 0, last: 1 }));
    expect(dragWindow(start, 6, 'move', 1000).window).toEqual({ first: 4, last: 5 });
  });

  it('resizes from either edge, down to one column', () => {
    expect(dragWindow(start, 6, 'end', STEP * 2.6).window).toEqual({ first: 1, last: 5 });
    expect(dragWindow(start, 6, 'start', -STEP * 0.6).window).toEqual({ first: 0, last: 2 });
    expect(dragWindow(start, 6, 'end', -1000)).toEqual({ frame: frameOf({ first: 1, last: 1 }), window: { first: 1, last: 1 } });
  });
});
