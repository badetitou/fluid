import { gzipSync } from 'node:zlib';

// Test helper: builds small tar(.gz) archives in memory, including hostile ones (traversal,
// escaping links) that a regular `tar` refuses to create.

export interface FixtureEntry {
  path: string;
  type?: 'file' | 'directory' | 'symlink' | 'hardlink' | 'pax' | 'paxGlobal' | 'fifo';
  content?: string | Buffer;
  linkPath?: string;
  mode?: number;
}

const FLAGS = { file: '0', directory: '5', symlink: '2', hardlink: '1', pax: 'x', paxGlobal: 'g', fifo: '6' };

function header(entry: FixtureEntry, size: number): Buffer {
  const block = Buffer.alloc(512);
  const put = (value: string, offset: number, length: number) =>
    block.write(value.slice(0, length), offset, length, 'utf8');
  const num = (value: number, offset: number, length: number) =>
    put(value.toString(8).padStart(length - 1, '0'), offset, length - 1);
  put(entry.path, 0, 100);
  num(entry.mode ?? (entry.type === 'directory' ? 0o755 : 0o644), 100, 8);
  num(0, 108, 8);
  num(0, 116, 8);
  num(size, 124, 12);
  num(0, 136, 12);
  block.fill(0x20, 148, 156);
  put(FLAGS[entry.type ?? 'file'], 156, 1);
  put(entry.linkPath ?? '', 157, 100);
  put('ustar\u000000', 257, 8);
  let sum = 0;
  for (const byte of block) sum += byte;
  put(`${sum.toString(8).padStart(6, '0')}\u0000 `, 148, 8);
  return block;
}

/** A pax record (`<length> key=value\n`). */
export function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  let length = body.length + 1;
  while (String(length).length + body.length !== length) length = String(length).length + body.length;
  return `${length}${body}`;
}

export function makeTar(entries: FixtureEntry[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? '');
    parts.push(header(entry, content.length), content, Buffer.alloc((512 - (content.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

export const makeTarGz = (entries: FixtureEntry[]) => gzipSync(makeTar(entries));
