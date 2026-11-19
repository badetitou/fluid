import type { ViewRef } from '@fluid/shared';

// The pure half of the Pharo script panel: which result opens a column, and the
// keys that run the script or close the panel.

/**
 * The concept opening `ref` in the next column: its type, when it has one the
 * source can open (`openable` null: unknown, every type is allowed).
 */
export function openableScriptConcept(ref: ViewRef | undefined, openable: ReadonlySet<string> | null): string | undefined {
  if (!ref?.type) return undefined;
  return openable === null || openable.has(ref.type) ? ref.type : undefined;
}

/** What a key pressed in the editor does: Cmd/Ctrl+Enter runs, Escape closes. */
export function editorKeyAction(key: { key: string; metaKey: boolean; ctrlKey: boolean }): 'run' | 'close' | undefined {
  if (key.key === 'Enter' && (key.metaKey || key.ctrlKey)) return 'run';
  if (key.key === 'Escape') return 'close';
  return undefined;
}

/** The title above the items of a collection result. */
export function itemsTitle(count: number, truncated: boolean | undefined): string {
  const noun = count === 1 ? 'item' : 'items';
  return truncated ? `First ${count} ${noun}` : `${count} ${noun}`;
}
