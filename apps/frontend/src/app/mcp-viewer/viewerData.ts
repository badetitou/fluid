import { parse, print } from 'graphql';
import type { ViewSpec } from '@fluid/shared';
import type { QueryResult } from './toolResult';

/** Fetches the stored queries again, with this `take` and these variables. */
export type RunQueriesFn = (args: { take?: number; variables?: Record<string, unknown> }) => Promise<Record<string, QueryResult>>;

interface Entry {
  result: QueryResult;
  /** Rows it was fetched with; unknown for the first run when the server did not say. */
  take?: number;
  /** The variables other than `take` it was fetched with. */
  varsKey: string;
}

/** A query text as the urql request prints it, so spec text and request text compare equal. */
export function normalizeQuery(text: string): string {
  try {
    return print(parse(text));
  } catch {
    return text.replace(/\s+/g, ' ').trim();
  }
}

/** Variables other than `take`, as a stable string. */
export function varsKey(variables: Record<string, unknown> | undefined): string {
  const entries = Object.entries(variables ?? {})
    .filter(([k]) => k !== 'take')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

const takeOf = (variables: Record<string, unknown> | undefined): number | undefined => {
  const take = variables?.take;
  return typeof take === 'number' && take > 0 ? take : undefined;
};

export type Decision =
  | { kind: 'hit'; result: QueryResult }
  | { kind: 'fetch'; name: string; take?: number; variables: Record<string, unknown> }
  | { kind: 'unknown' };

/**
 * Answers the engine's queries from what `show_view` already ran (by query text -> stored query name),
 * and goes back to the server (`run_queries`) for what it does not hold: more rows, other variables.
 */
export class ViewerData {
  private readonly names = new Map<string, string>();
  private readonly entries = new Map<string, Entry>();

  constructor(
    spec: ViewSpec,
    initial: Record<string, QueryResult>,
    take: number | undefined,
    private readonly run: RunQueriesFn,
  ) {
    for (const [name, q] of Object.entries(spec.queries)) {
      this.names.set(normalizeQuery(q.query), name);
      const result = initial[name];
      if (result) this.entries.set(name, { result, take, varsKey: varsKey(q.variables) });
    }
  }

  decide(queryText: string, variables: Record<string, unknown> | undefined): Decision {
    const name = this.names.get(normalizeQuery(queryText));
    if (name === undefined) return { kind: 'unknown' };
    const entry = this.entries.get(name);
    const take = takeOf(variables);
    const enough =
      entry !== undefined &&
      entry.varsKey === varsKey(variables) &&
      (take === undefined || entry.take === undefined || take <= entry.take);
    if (entry && enough) return { kind: 'hit', result: entry.result };
    const others = Object.fromEntries(Object.entries(variables ?? {}).filter(([k]) => k !== 'take'));
    return { kind: 'fetch', name, take, variables: others };
  }

  async answer(queryText: string, variables: Record<string, unknown> | undefined): Promise<QueryResult> {
    const decision = this.decide(queryText, variables);
    if (decision.kind === 'hit') return decision.result;
    if (decision.kind === 'unknown') return { errors: [{ message: 'This query is not part of the view shown here.' }] };
    const hasVariables = Object.keys(decision.variables).length > 0;
    const results = await this.run({ take: decision.take, ...(hasVariables ? { variables: decision.variables } : {}) });
    const result = results[decision.name];
    if (!result) return { errors: [{ message: `The server did not answer “${decision.name}”.` }] };
    this.entries.set(decision.name, { result, take: decision.take, varsKey: varsKey(variables) });
    return result;
  }
}
