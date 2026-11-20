import { createWriteStream } from 'node:fs';
import { copyFile, lstat, mkdir, realpath, rm, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { RepoFetchError } from './fetch-error';
import { readTar, type TarEntry } from './tar';

// Writes a GitHub tarball into a directory: the top-level `<repo>-<sha>/` folder is stripped, and
// nothing is ever written, linked or copied outside that directory.

const UNSAFE = 'Archive contains an unsafe path';

/**
 * Path of an archive entry relative to the repository root (top-level folder stripped), or `null`
 * for the top-level folder itself. Throws on absolute paths and `..` segments.
 */
export function repoRelativePath(archivePath: string): string | null {
  if (archivePath.startsWith('/') || /^[A-Za-z]:/.test(archivePath) || archivePath.includes('\0')) {
    throw new RepoFetchError(UNSAFE);
  }
  const parts = archivePath.split('/').filter((s) => s !== '' && s !== '.');
  if (parts.includes('..')) throw new RepoFetchError(UNSAFE);
  return parts.length <= 1 ? null : parts.slice(1).join('/');
}

const isInside = (root: string, p: string) => p === root || p.startsWith(root + path.sep);

/** Whether a symlink stored at `rel` with target `link` stays inside `root`, lexically. */
export function symlinkStaysInside(root: string, rel: string, link: string): boolean {
  if (link === '' || path.isAbsolute(link) || link.includes('\0')) return false;
  return isInside(root, path.resolve(path.dirname(path.join(root, rel)), link));
}

interface ExtractState {
  root: string;
  maxBytes: number;
  written: number;
  files: Set<string>;
  symlinks: Set<string>;
}

/** Refuses to write through a symlink created earlier by the same archive. */
function assertNotUnderSymlink(state: ExtractState, rel: string): void {
  const parts = rel.split('/');
  for (let i = 1; i < parts.length; i++) {
    if (state.symlinks.has(parts.slice(0, i).join('/'))) throw new RepoFetchError(UNSAFE);
  }
}

async function clear(target: string): Promise<void> {
  const stat = await lstat(target).catch(() => null);
  if (stat && !stat.isDirectory()) await unlink(target);
}

async function writeFile(state: ExtractState, entry: TarEntry, target: string): Promise<void> {
  if (state.written + entry.size > state.maxBytes) throw new RepoFetchError('Repository is too large');
  state.written += entry.size;
  await mkdir(path.dirname(target), { recursive: true });
  await clear(target);
  const mode = entry.mode & 0o111 ? 0o755 : 0o644;
  await pipeline(Readable.from(entry.body), createWriteStream(target, { mode, flags: 'wx' }));
}

async function writeEntry(state: ExtractState, entry: TarEntry): Promise<void> {
  const rel = repoRelativePath(entry.path);
  if (rel === null) return;
  assertNotUnderSymlink(state, rel);
  const target = path.join(state.root, rel);
  switch (entry.type) {
    case 'directory':
      await mkdir(target, { recursive: true });
      return;
    case 'file':
      await writeFile(state, entry, target);
      state.files.add(rel);
      return;
    case 'symlink':
      // Links leaving the repository are skipped (a repository may legitimately hold some).
      if (!symlinkStaysInside(state.root, rel, entry.linkPath)) return;
      await mkdir(path.dirname(target), { recursive: true });
      await clear(target);
      await symlink(entry.linkPath, target);
      state.symlinks.add(rel);
      return;
    case 'hardlink': {
      // Copied rather than linked, and only from a regular file this archive already wrote.
      const source = (() => {
        try {
          return repoRelativePath(entry.linkPath);
        } catch {
          return null;
        }
      })();
      if (source === null || !state.files.has(source)) return;
      await mkdir(path.dirname(target), { recursive: true });
      await clear(target);
      await copyFile(path.join(state.root, source), target);
      state.files.add(rel);
      return;
    }
    default:
      return; // devices, FIFOs…: never created
  }
}

/** Removes symlinks that resolve outside the root once every link exists (chains, dangling links). */
async function pruneSymlinks(state: ExtractState): Promise<void> {
  const realRoot = await realpath(state.root);
  for (const rel of state.symlinks) {
    const target = path.join(state.root, rel);
    const resolved = await realpath(target).catch(() => null);
    if (resolved === null || !isInside(realRoot, resolved)) await rm(target, { force: true });
  }
}

/**
 * Extracts an uncompressed tar stream into `root` (an existing directory). `maxBytes` caps the total
 * size of the extracted files.
 */
export async function extractTar(
  source: AsyncIterable<Buffer>,
  root: string,
  options: { maxBytes: number; signal?: AbortSignal },
): Promise<void> {
  const state: ExtractState = {
    root: path.resolve(root),
    maxBytes: options.maxBytes,
    written: 0,
    files: new Set(),
    symlinks: new Set(),
  };
  for await (const entry of readTar(source)) {
    options.signal?.throwIfAborted();
    await writeEntry(state, entry);
  }
  await pruneSymlinks(state);
}
