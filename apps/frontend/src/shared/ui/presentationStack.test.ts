import { describe, expect, it } from 'vitest';
import { enterPresentation, isTopPresentation } from './presentationStack';

describe('presentationStack', () => {
  it('only the innermost frame is on top', () => {
    const outer = Symbol('outer');
    const inner = Symbol('inner');
    const leaveOuter = enterPresentation(outer);
    const leaveInner = enterPresentation(inner);
    expect(isTopPresentation(inner)).toBe(true);
    expect(isTopPresentation(outer)).toBe(false);
    leaveInner();
    expect(isTopPresentation(outer)).toBe(true);
    leaveOuter();
    expect(isTopPresentation(outer)).toBe(false);
  });

  it('leaving twice is harmless', () => {
    const id = Symbol('frame');
    const leave = enterPresentation(id);
    leave();
    leave();
    expect(isTopPresentation(id)).toBe(false);
  });
});
