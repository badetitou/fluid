import { describe, expect, it } from 'vitest';
import { parsePax, readTar, type TarEntry } from './tar';
import { makeTar, paxRecord } from './tar-fixture';

async function* chunked(data: Buffer, size: number): AsyncGenerator<Buffer> {
  for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
}

async function text(entry: TarEntry): Promise<string> {
  const parts: Buffer[] = [];
  for await (const chunk of entry.body) parts.push(chunk);
  return Buffer.concat(parts).toString('utf8');
}

describe('tar reader', () => {
  it('parses pax records', () => {
    expect(parsePax(Buffer.from(paxRecord('path', 'a/b') + paxRecord('comment', 'x=y')))).toEqual({
      path: 'a/b',
      comment: 'x=y',
    });
  });

  it('reads entries across arbitrary chunk boundaries, applying pax headers to the next entry', async () => {
    const long = `top/${'d/'.repeat(80)}file.txt`;
    const tar = makeTar([
      { path: 'pax_global_header', type: 'paxGlobal', content: paxRecord('comment', 'sha') },
      { path: 'top/', type: 'directory' },
      { path: 'PaxHeader', type: 'pax', content: paxRecord('path', long) },
      { path: 'top/truncated', content: 'x'.repeat(700) },
      { path: 'top/link', type: 'symlink', linkPath: 'truncated' },
    ]);
    const seen: Array<[string, string, string]> = [];
    for await (const entry of readTar(chunked(tar, 7))) {
      seen.push([entry.type, entry.path, entry.type === 'file' ? await text(entry) : entry.linkPath]);
    }
    expect(seen).toEqual([
      ['directory', 'top/', ''],
      ['file', long, 'x'.repeat(700)],
      ['symlink', 'top/link', 'truncated'],
    ]);
  });

  it('skips the unread part of a body', async () => {
    const tar = makeTar([
      { path: 'a', content: 'y'.repeat(2000) },
      { path: 'b', content: 'second' },
    ]);
    const names: string[] = [];
    for await (const entry of readTar(chunked(tar, 100))) {
      names.push(entry.path);
      if (entry.path === 'a') {
        for await (const chunk of entry.body) {
          expect(chunk.length).toBeGreaterThan(0);
          break; // leaves most of the body unread
        }
      } else {
        expect(await text(entry)).toBe('second');
      }
    }
    expect(names).toEqual(['a', 'b']);
  });

  it('rejects a corrupted header and a truncated archive', async () => {
    const tar = makeTar([{ path: 'a', content: 'hello' }]);
    const corrupt = Buffer.from(tar);
    corrupt[0] = 0x62;
    await expect(async () => {
      for await (const entry of readTar(chunked(corrupt, 512))) void entry;
    }).rejects.toThrow('Invalid tar header');
    await expect(async () => {
      for await (const entry of readTar(chunked(tar.subarray(0, 600), 512))) await text(entry);
    }).rejects.toThrow('Unexpected end of archive');
  });
});
