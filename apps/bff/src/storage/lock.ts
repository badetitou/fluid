import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCK_FILE = 'fluid.lock';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readPid(file: string): number {
  try {
    return Number.parseInt(readFileSync(file, 'utf8'), 10);
  } catch {
    return Number.NaN;
  }
}

/** Takes an exclusive lock in `dir` (created if missing) and returns a release function. */
export function acquireDirLock(dir: string): () => void {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, LOCK_FILE);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, String(process.pid), { flag: 'wx' });
      return () => {
        try {
          unlinkSync(file);
        } catch {
          // already gone
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const pid = readPid(file);
      if (Number.isInteger(pid) && isAlive(pid)) {
        throw Object.assign(new Error(`data dir ${dir} is in use by process ${pid}`), {
          code: 'FLUID_DATA_DIR_LOCKED',
          pid,
          dir,
        });
      }
      // Stale lock (dead owner or garbage content): take over.
      try {
        unlinkSync(file);
      } catch {
        // raced with another cleaner; retry
      }
    }
  }
  throw new Error(`could not lock data dir ${dir}`);
}
