import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { createModelProcessManager, type ModelProcessOptions } from '../repos/model-process';
import type { ModelProcessManager } from '../repos/types';

// Test harness of the Model process manager: a fake `model-graphql` (fake-model-graphql.mjs), temp
// repository dirs whose name picks the fake's behaviour, and helpers to check processes really die.

export const FAKE_BIN = fileURLToPath(new URL('./fake-model-graphql.mjs', import.meta.url));

/** Registers the vitest hooks; returns the harness. Call once at the top of a test file. */
export function useModelProcessHarness() {
  let root = '';
  const managers: ModelProcessManager[] = [];

  beforeAll(() => {
    chmodSync(FAKE_BIN, 0o755);
    root = mkdtempSync(join(tmpdir(), 'fluid-model-process-'));
  });
  afterEach(async () => {
    await Promise.all(managers.splice(0).map((m) => m.stopAll()));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  return {
    root: () => root,

    repoDir(name: string): string {
      const dir = join(root, name);
      mkdirSync(dir, { recursive: true });
      return dir;
    },

    manager(maxRunning = 3, options: ModelProcessOptions = {}, bin = FAKE_BIN) {
      const m = createModelProcessManager(
        { modelGraphqlBin: bin, maxRunning },
        { pollIntervalMs: 50, readyTimeoutMs: 5_000, killGraceMs: 300, ...options },
      );
      managers.push(m);
      return m;
    },
  };
}

export async function query(url: string): Promise<{ argv: string[]; pid: number }> {
  const response = await fetch(url, { method: 'POST', body: '{"query":"{ __typename }"}' });
  const body = (await response.json()) as { data: { argv: string[]; pid: number } };
  return body.data;
}

/** Whether the process lives; false for a missing pid (never pass 0 or -1 to `process.kill`). */
export function alive(pid: number | undefined): boolean {
  if (pid === undefined || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The pid the fake wrote in `dir`, if it was ever spawned there. */
export function spawnedPid(dir: string): number | undefined {
  const file = join(dir, 'fake.pid');
  return existsSync(file) ? Number(readFileSync(file, 'utf8')) : undefined;
}

export async function until(check: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}
