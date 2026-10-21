import { describe, expect, it } from 'vitest';
import { SIDER_MAX_WIDTH, SIDER_MIN_WIDTH, siderWidthAfterDrag } from './model';

describe('siderWidthAfterDrag', () => {
  it('grows a left sider when dragged right', () => {
    expect(siderWidthAfterDrag(240, 30, 'left')).toBe(270);
  });

  it('grows a right sider when dragged left', () => {
    expect(siderWidthAfterDrag(240, -30, 'right')).toBe(270);
  });

  it('stays within bounds', () => {
    expect(siderWidthAfterDrag(240, -1000, 'left')).toBe(SIDER_MIN_WIDTH);
    expect(siderWidthAfterDrag(240, 1000, 'left')).toBe(SIDER_MAX_WIDTH);
  });
});
