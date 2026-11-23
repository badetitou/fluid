// Which files of a repository are worth sending to Model: the languages it indexes (Java,
// TypeScript/TSX, Python, Pharo Tonel) and the manifests it reads to detect a project. Everything
// else is dropped before it is copied, to keep the page's memory in check.

const SOURCE = /\.(java|tsx?|py|st)$/i;
const DECLARATIONS = /\.d\.ts$/i;
const MANIFESTS = new Set(['package.json', 'tsconfig.json', 'pom.xml', 'pyproject.toml', '.project']);
const IGNORED = /(^|\/)(node_modules|\.git|dist|build|target|vendor|__pycache__|\.venv)\//;

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
export const MAX_SOURCE_FILES = 3_000;

export function isModelSource(path: string, size: number): boolean {
  if (size === 0 || size > MAX_FILE_BYTES || IGNORED.test(path) || DECLARATIONS.test(path)) return false;
  return SOURCE.test(path) || MANIFESTS.has(path.slice(path.lastIndexOf('/') + 1));
}

/** A stateful `accept` for `parseTar`: `isModelSource` plus the total file and byte limits. */
export function createSourceAcceptor(): (path: string, size: number) => boolean {
  let files = 0;
  let bytes = 0;
  return (path, size) => {
    if (!isModelSource(path, size)) return false;
    if (files + 1 > MAX_SOURCE_FILES || bytes + size > MAX_SOURCE_BYTES) {
      throw new Error('This repository is too large to be analysed in the browser.');
    }
    files += 1;
    bytes += size;
    return true;
  };
}
