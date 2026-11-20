import { lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractTar, repoRelativePath, symlinkStaysInside } from './extract';
import { type FixtureEntry, makeTar } from '../test-support/tar-fixture';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'fluid-extract-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function* once(data: Buffer): AsyncGenerator<Buffer> {
  yield data;
}
const extract = (entries: FixtureEntry[], maxBytes = 1_000_000) =>
  extractTar(once(makeTar([{ path: 'repo-sha/', type: 'directory' }, ...entries])), root, { maxBytes });
const exists = (rel: string) => lstat(path.join(root, rel)).then(() => true, () => false);

describe('repoRelativePath', () => {
  it('strips the top-level folder', () => {
    expect(repoRelativePath('repo-sha/')).toBeNull();
    expect(repoRelativePath('repo-sha/src/./a.ts')).toBe('src/a.ts');
    expect(repoRelativePath('pax_global_header')).toBeNull();
  });

  it.each(['/etc/passwd', 'repo/../../x', 'repo/a/../../b', 'C:/x', 'repo/a\0b'])('rejects %s', (p) => {
    expect(() => repoRelativePath(p)).toThrow('unsafe path');
  });
});

describe('symlinkStaysInside', () => {
  it('accepts relative links inside the root only', () => {
    expect(symlinkStaysInside('/r', 'a/link', '../b')).toBe(true);
    expect(symlinkStaysInside('/r', 'a/link', '../../b')).toBe(false);
    expect(symlinkStaysInside('/r', 'link', '/etc/passwd')).toBe(false);
    expect(symlinkStaysInside('/r', 'link', '')).toBe(false);
  });
});

describe('extractTar', () => {
  it('writes files and folders without the top-level folder, keeping the executable bit', async () => {
    await extract([
      { path: 'repo-sha/src/', type: 'directory' },
      { path: 'repo-sha/src/a.st', content: 'Object subclass: #A' },
      { path: 'repo-sha/run.sh', content: '#!/bin/sh', mode: 0o755 },
      { path: 'repo-sha/fifo', type: 'fifo' },
    ]);
    expect((await readdir(root)).sort()).toEqual(['run.sh', 'src']);
    expect(await readFile(path.join(root, 'src/a.st'), 'utf8')).toBe('Object subclass: #A');
    expect((await stat(path.join(root, 'run.sh'))).mode & 0o111).not.toBe(0);
  });

  it('keeps links inside the repository and drops links leading outside', async () => {
    await extract([
      { path: 'repo-sha/src/a.st', content: 'A' },
      { path: 'repo-sha/inside', type: 'symlink', linkPath: 'src/a.st' },
      { path: 'repo-sha/abs', type: 'symlink', linkPath: '/etc/passwd' },
      { path: 'repo-sha/up', type: 'symlink', linkPath: '../outside' },
      // Each link is lexically inside, but `b` resolves through `a` to the parent of the root.
      { path: 'repo-sha/a', type: 'symlink', linkPath: '.' },
      { path: 'repo-sha/b', type: 'symlink', linkPath: 'a/..' },
      { path: 'repo-sha/dangling', type: 'symlink', linkPath: 'missing' },
    ]);
    expect(await readlink(path.join(root, 'inside'))).toBe('src/a.st');
    expect(await exists('a')).toBe(true);
    for (const rel of ['abs', 'up', 'b', 'dangling']) expect(await exists(rel)).toBe(false);
  });

  it('copies hardlinks to files of the archive, never to anything else', async () => {
    await extract([
      { path: 'repo-sha/a.st', content: 'A' },
      { path: 'repo-sha/copy.st', type: 'hardlink', linkPath: 'repo-sha/a.st' },
      { path: 'repo-sha/passwd', type: 'hardlink', linkPath: '/etc/passwd' },
      { path: 'repo-sha/up', type: 'hardlink', linkPath: 'repo-sha/../../x' },
    ]);
    expect(await readFile(path.join(root, 'copy.st'), 'utf8')).toBe('A');
    expect((await lstat(path.join(root, 'copy.st'))).isSymbolicLink()).toBe(false);
    expect(await exists('passwd')).toBe(false);
    expect(await exists('up')).toBe(false);
  });

  it('never copies a hardlink through a link that replaced its source', async () => {
    // `root` sits next to `secret`: `s2` is lexically inside but resolves outside through `s1`.
    const work = await mkdtemp(path.join(tmpdir(), 'fluid-extract-'));
    await writeFile(path.join(work, 'secret'), 'top secret');
    const inner = path.join(work, 'root');
    await mkdir(inner);
    const entries: FixtureEntry[] = [
      { path: 'repo-sha/', type: 'directory' },
      { path: 'repo-sha/s1', type: 'symlink', linkPath: '.' },
      { path: 'repo-sha/s2', type: 'symlink', linkPath: 's1/../secret' },
      { path: 'repo-sha/f', content: 'x' },
      { path: 'repo-sha/f', type: 'symlink', linkPath: 's2' },
      { path: 'repo-sha/h', type: 'hardlink', linkPath: 'repo-sha/f' },
    ];
    try {
      await extractTar(once(makeTar(entries)), inner, { maxBytes: 1_000_000 });
      await expect(lstat(path.join(inner, 'h'))).rejects.toThrow();
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  it('charges hardlink copies to the size cap', async () => {
    const big = { path: 'repo-sha/big', content: Buffer.alloc(1_000_000, 1) };
    const links = Array.from({ length: 5 }, (_, i): FixtureEntry => ({
      path: `repo-sha/h${i}`,
      type: 'hardlink',
      linkPath: 'repo-sha/big',
    }));
    await expect(extract([big, ...links], 2_000_000)).rejects.toThrow('too large');
  });

  it.each([
    ['a traversal', [{ path: 'repo-sha/../../evil', content: 'x' }]],
    ['an absolute path', [{ path: '/tmp/evil', content: 'x' }]],
    [
      'a write through a link',
      [
        { path: 'repo-sha/dir', type: 'symlink', linkPath: '.' },
        { path: 'repo-sha/dir/evil', content: 'x' },
      ],
    ],
  ] as Array<[string, FixtureEntry[]]>)('rejects %s', async (_name, entries) => {
    await expect(extract(entries)).rejects.toThrow('unsafe path');
    expect(await exists('../evil')).toBe(false);
  });

  it('caps the total extracted size', async () => {
    await expect(
      extract(
        [
          { path: 'repo-sha/a', content: 'x'.repeat(600) },
          { path: 'repo-sha/b', content: 'x'.repeat(600) },
        ],
        1000,
      ),
    ).rejects.toThrow('too large');
  });
});
