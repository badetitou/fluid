import { parse, print } from 'graphql';
import type { ViewSpec } from '@fluid/shared';
import { isPaged, pagedPaths } from '../../views/paging/model';
import type { QueryResult } from './toolResult';
import { trimRows } from './trimRows';

/** Fetches the stored queries again, with this `take` and these variables. */
export type RunQueriesFn = (args: { take?: number; variables?: Record<string, unknown> }) => Promise<Record<string, QueryResult>>;

/** The `take` the server applies when none is given (DEFAULT_TAKE of `fluid mcp`). */
export const SERVER_DEFAULT_TAKE = 100;

interface Entry {
  result: QueryResult;
  /** Rows its query was fetched with (the server overrides a query's own `take`, so this is what ran). */
  take: number;
}

interface Candidate {
  name: string;
  /** The variables other than `take` the stored query declares. */
  varsKey: string;
  paged: boolean;
  paths: string[][];
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

/**
 * Answers the engine's queries from what `show_view` already ran (by query text and variables -> stored
 * query name), and goes back to the server (`run_queries`) for what it does not hold: more rows than
 * stored, other variables. A stored answer is cut to the rows asked when fewer are wanted.
 */
export class ViewerData {
  private readonly byText = new Map<string, Candidate[]>();
  private readonly entries = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<Record<string, QueryResult>>>();

  constructor(
    spec: ViewSpec,
    initial: Record<string, QueryResult>,
    take: number | undefined,
    private readonly run: RunQueriesFn,
  ) {
    for (const [name, q] of Object.entries(spec.queries)) {
      const candidate: Candidate = { name, varsKey: varsKey(q.variables), paged: isPaged(q.query), paths: pagedPaths(q.query) };
      const key = normalizeQuery(q.query);
      this.byText.set(key, [...(this.byText.get(key) ?? []), candidate]);
      const result = initial[name];
      if (result) this.entries.set(this.entryKey(name, candidate.varsKey), { result, take: take ?? SERVER_DEFAULT_TAKE });
    }
  }

  private entryKey = (name: string, vars: string) => `${name}|${vars}`;

  private candidate(queryText: string, vars: string): Candidate | undefined {
    const candidates = this.byText.get(normalizeQuery(queryText));
    return candidates?.find((c) => c.varsKey === vars) ?? candidates?.[0];
  }

  private store(name: string, vars: string, take: number, result: QueryResult): void {
    this.entries.set(this.entryKey(name, vars), { result, take });
  }

  private fetch(name: string, take: number | undefined, variables: Record<string, unknown>): Promise<Record<string, QueryResult>> {
    const key = `${name}|${take}|${varsKey(variables)}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const hasVariables = Object.keys(variables).length > 0;
    const promise = this.run({ take, ...(hasVariables ? { variables } : {}) }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  async answer(queryText: string, variables: Record<string, unknown> | undefined): Promise<QueryResult> {
    const vars = varsKey(variables);
    const found = this.candidate(queryText, vars);
    if (!found) return { errors: [{ message: 'This query is not part of the view shown here.' }] };
    const take = takeOf(variables);
    const entry = this.entries.get(this.entryKey(found.name, vars));
    if (entry && (!found.paged || take === undefined || take <= entry.take)) {
      if (!found.paged || take === undefined || take === entry.take || entry.result.data === undefined) return entry.result;
      return { ...entry.result, data: trimRows(entry.result.data, found.paths, take) };
    }
    const others = Object.fromEntries(Object.entries(variables ?? {}).filter(([k]) => k !== 'take'));
    const results = await this.fetch(found.name, take, others);
    const result = results[found.name];
    if (!result) return { errors: [{ message: `The server did not answer “${found.name}”.` }] };
    const stored = take ?? SERVER_DEFAULT_TAKE;
    this.store(found.name, vars, stored, result);
    // Without variables every query ran with its own: all of the answers are worth keeping.
    if (Object.keys(others).length === 0) this.keepAll(results, found.name, stored);
    return result;
  }

  private keepAll(results: Record<string, QueryResult>, except: string, take: number): void {
    for (const candidates of this.byText.values()) {
      for (const c of candidates) if (c.name !== except && results[c.name]) this.store(c.name, c.varsKey, take, results[c.name]);
    }
  }
}
