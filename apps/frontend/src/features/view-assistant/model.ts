import type { ViewScope, ViewSpec } from '@fluid/shared';
import type { ChatMessage } from '../../bff/client';
import type { AssistantTurn } from '../../store';

/** Key of a persisted assistant conversation: one per concept, scope and edited view. */
export function sessionKeyOf(concept: string, scope: ViewScope | undefined, editingViewId: string | undefined): string {
  return `${concept}|${scope ?? ''}|${editingViewId ?? 'new'}`;
}

/** Successful turns numbered as spec versions (v1, v2, …); v0 is the saved view. */
export function versionTurns(turns: AssistantTurn[]): Map<string, number> {
  const versions = new Map<string, number>();
  let n = 0;
  for (const t of turns) if (t.spec) versions.set(t.id, ++n);
  return versions;
}

/** Every version's spec, v0 being the saved view when refining one. */
export function specsByVersion(
  turns: AssistantTurn[],
  versions: Map<string, number>,
  initialSpec?: ViewSpec,
): Map<number, ViewSpec> {
  const map = new Map<number, ViewSpec>();
  if (initialSpec) map.set(0, initialSpec);
  for (const t of turns) {
    const v = versions.get(t.id);
    if (v !== undefined && t.spec) map.set(v, t.spec);
  }
  return map;
}

/**
 * Conversation replayed to the model: the saved view (when refining one), then
 * every successful exchange up to the version the new prompt builds on.
 */
export function buildHistory(
  turns: AssistantTurn[],
  versions: Map<string, number>,
  base: number,
  initialSpec?: ViewSpec,
): ChatMessage[] {
  const history: ChatMessage[] = [];
  if (initialSpec) {
    history.push(
      { role: 'user', content: 'Here is the current saved view. Refine it with my next requests.' },
      { role: 'assistant', content: JSON.stringify(initialSpec) },
    );
  }
  for (const t of turns) {
    const v = versions.get(t.id);
    if (v === undefined) continue;
    if (v > base) break;
    history.push({ role: 'user', content: t.prompt }, { role: 'assistant', content: JSON.stringify(t.spec) });
  }
  return history;
}

/** One-line summary of a view's widgets, e.g. `table “Accounts” · pie`. */
export function summarizeSpec(spec: ViewSpec): string {
  const parts = (spec.widgets ?? []).map((w) => (w.title ? `${w.type} “${w.title}”` : w.type));
  return parts.length ? parts.join(' · ') : 'No widget';
}

export function versionLabel(v: number): string {
  return v === 0 ? 'saved view' : `v${v}`;
}

/** The version a turn refined, when it is not simply the previous one. */
export function refinedFrom(turn: AssistantTurn, version: number | undefined): number | null {
  return turn.basedOn !== null && turn.basedOn !== (version ?? 0) - 1 ? turn.basedOn : null;
}

/** Live model output accumulated from streamed deltas. */
export interface LiveOutput {
  thinking: string;
  text: string;
}

export function appendDelta(cur: LiveOutput | null, delta: { kind: 'text' | 'thinking'; text: string }): LiveOutput {
  const next = cur ?? { thinking: '', text: '' };
  return delta.kind === 'thinking'
    ? { ...next, thinking: next.thinking + delta.text }
    : { ...next, text: next.text + delta.text };
}
