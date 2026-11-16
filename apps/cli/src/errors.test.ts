import { describe, expect, it } from 'vitest';
import { describeStartupError } from './errors';

describe('describeStartupError', () => {
  it('explains a locked data dir', () => {
    const err = Object.assign(new Error('x'), { code: 'FLUID_DATA_DIR_LOCKED', pid: 42, dir: '/d' });
    expect(describeStartupError(err, 4001)).toBe('another fluid uses /d (pid 42): stop it or pass --data-dir');
  });
  it('explains a busy port', () => {
    expect(describeStartupError({ code: 'EADDRINUSE' }, 4001)).toBe('port 4001 is busy: pass --port');
  });
  it('falls back to the message', () => {
    expect(describeStartupError(new Error('boom'), 1)).toBe('boom');
    expect(describeStartupError('plain', 1)).toBe('plain');
  });
});
