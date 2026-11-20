// Minimal streaming reader for (uncompressed) tar archives: ustar headers, pax extended headers
// (`path`, `linkpath`, `size`) and GNU long names. Enough for GitHub's codeload tarballs, with no
// dependency. Only reads: deciding what is safe to write is `extract.ts`'s job.

import { RepoFetchError } from './fetch-error';

const BLOCK = 512;

export type TarEntryType = 'file' | 'directory' | 'symlink' | 'hardlink' | 'other';

export interface TarEntry {
  /** Path inside the archive, as stored (not normalised). */
  path: string;
  type: TarEntryType;
  size: number;
  mode: number;
  /** Target of a symlink or hardlink. */
  linkPath: string;
  /** Entry content; must be consumed (or ignored) before asking for the next entry. */
  body: AsyncIterable<Buffer>;
}

/** Pulls exact byte counts out of a chunked source. */
class ChunkReader {
  private buf: Buffer = Buffer.alloc(0);

  constructor(private readonly source: AsyncIterator<Buffer>) {}

  /** `n` bytes, or `null` when the source ends cleanly before any byte. */
  async read(n: number): Promise<Buffer | null> {
    while (this.buf.length < n) {
      const next = await this.source.next();
      if (next.done) {
        if (this.buf.length === 0) return null;
        throw new RepoFetchError('Unexpected end of archive');
      }
      this.buf = this.buf.length === 0 ? next.value : Buffer.concat([this.buf, next.value]);
    }
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }

  /** Between 1 and `max` bytes (`max` > 0); throws at the end of the source. */
  async take(max: number): Promise<Buffer> {
    if (this.buf.length === 0) {
      const next = await this.source.next();
      if (next.done) throw new RepoFetchError('Unexpected end of archive');
      this.buf = next.value;
    }
    const out = this.buf.subarray(0, Math.min(max, this.buf.length));
    this.buf = this.buf.subarray(out.length);
    return out;
  }
}

function text(block: Buffer, start: number, length: number): string {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8');
}

function octal(block: Buffer, start: number, length: number): number {
  const field = block.subarray(start, start + length);
  // GNU base-256 encoding for large values: high bit of the first byte set.
  if ((field[0] ?? 0) & 0x80) {
    let value = (field[0] ?? 0) & 0x7f;
    for (let i = 1; i < field.length; i++) value = value * 256 + (field[i] ?? 0);
    return value;
  }
  const digits = text(block, start, length).trim();
  if (digits === '') return 0;
  if (!/^[0-7]+$/.test(digits)) throw new RepoFetchError('Invalid tar header');
  return parseInt(digits, 8);
}

function checksumOk(block: Buffer): boolean {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : (block[i] ?? 0);
  return sum === octal(block, 148, 8);
}

/** Parses pax records: `<length> <key>=<value>\n`. */
export function parsePax(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos);
    if (space === -1) break;
    const length = parseInt(data.subarray(pos, space).toString('utf8'), 10);
    if (!Number.isFinite(length) || length <= 0 || pos + length > data.length) break;
    const record = data.subarray(space + 1, pos + length - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    pos += length;
  }
  return out;
}

function entryType(flag: string): TarEntryType | 'pax' | 'paxGlobal' | 'gnuLongName' | 'gnuLongLink' {
  switch (flag) {
    case '':
    case '0':
    case '7':
      return 'file';
    case '5':
      return 'directory';
    case '2':
      return 'symlink';
    case '1':
      return 'hardlink';
    case 'x':
      return 'pax';
    case 'g':
      return 'paxGlobal';
    case 'L':
      return 'gnuLongName';
    case 'K':
      return 'gnuLongLink';
    default:
      return 'other';
  }
}

const padding = (size: number) => (BLOCK - (size % BLOCK)) % BLOCK;

/** Metadata blocks (pax, GNU long names) are read whole: cap them so a hostile archive cannot. */
const MAX_META_BYTES = 1024 * 1024;

/** Yields the entries of a tar stream in order. Each entry's body must be drained before the next. */
export async function* readTar(source: AsyncIterable<Buffer>): AsyncGenerator<TarEntry> {
  const reader = new ChunkReader(source[Symbol.asyncIterator]());
  let pending: { path?: string; linkPath?: string; size?: number } = {};
  for (;;) {
    const block = await reader.read(BLOCK);
    if (block === null || block.every((b) => b === 0)) return;
    if (!checksumOk(block)) throw new RepoFetchError('Invalid tar header');
    const type = entryType(text(block, 156, 1));
    const size = pending.size ?? octal(block, 124, 12);
    if (type === 'pax' || type === 'paxGlobal' || type === 'gnuLongName' || type === 'gnuLongLink') {
      if (size > MAX_META_BYTES) throw new RepoFetchError('Invalid tar header');
      const data = (await reader.read(size + padding(size))) ?? Buffer.alloc(0);
      const content = data.subarray(0, size);
      if (type === 'pax') {
        const pax = parsePax(content);
        if (pax.path !== undefined) pending.path = pax.path;
        if (pax.linkpath !== undefined) pending.linkPath = pax.linkpath;
        if (pax.size !== undefined && /^\d+$/.test(pax.size)) pending.size = Number(pax.size);
      } else if (type === 'gnuLongName') pending.path = text(content, 0, content.length);
      else if (type === 'gnuLongLink') pending.linkPath = text(content, 0, content.length);
      continue;
    }
    const prefix = text(block, 345, 155);
    const name = text(block, 0, 100);
    const dataSize = type === 'file' || type === 'other' ? size : 0;
    let left = dataSize;
    async function* body(): AsyncGenerator<Buffer> {
      while (left > 0) {
        const chunk = await reader.take(left);
        left -= chunk.length;
        yield chunk;
      }
    }
    yield {
      path: pending.path ?? (prefix ? `${prefix}/${name}` : name),
      type,
      size: dataSize,
      mode: octal(block, 100, 8),
      linkPath: pending.linkPath ?? text(block, 157, 100),
      body: { [Symbol.asyncIterator]: body },
    };
    pending = {};
    // Skips whatever the consumer left unread.
    while (left > 0) left -= (await reader.take(left)).length;
    await reader.read(padding(dataSize));
  }
}
