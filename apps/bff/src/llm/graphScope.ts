import { isGraphConcept, type ViewSpecDraft } from '@fluid/shared';
import type { ConceptSchemaInfo, EntryPointInfo } from './types';

// A whole-graph dashboard (concept `@graph`) is not bound to one concept: its
// queries may start from any root query field. The prompt lists those entry
// points instead of a single list / by-id query.

export function isGraphSchema(schema: ConceptSchemaInfo): boolean {
  return isGraphConcept(schema.name);
}

/** Path from an entry point's list query result to its rows (e.g. "characters.results"). */
export function entryRowsPath(entry: EntryPointInfo): string | undefined {
  if (!entry.listQuery) return undefined;
  return entry.listItemsPath ? `${entry.listQuery}.${entry.listItemsPath}` : entry.listQuery;
}

function describeEntryPoint(entry: EntryPointInfo): string {
  const parts: string[] = [];
  if (entry.listQuery) {
    const args = entry.listLimitArg ? `(${entry.listLimitArg}: Int)` : '';
    const shape = entry.listItemsPath
      ? `${entry.listQuery}${args} { ${entry.listItemsPath} { ... } } — rows at path "${entryRowsPath(entry)}"`
      : `${entry.listQuery}${args} { ... }`;
    parts.push(`list: ${shape}`);
  }
  if (entry.byIdQuery) {
    parts.push(`by id: ${entry.byIdQuery}(${entry.byIdArgName ?? 'id'}: ${entry.byIdArgType ?? 'ID!'})`);
  }
  const fields = entry.fields.length ? `\n      fields: ${entry.fields.join(', ')}` : '';
  return `  - ${entry.concept}: ${parts.join('; ') || '(no root query)'}${fields}`;
}

/** Scope rules for a whole-graph dashboard, listing every entry point. */
export function graphScopeInstructions(schema: ConceptSchemaInfo): string {
  const entries = schema.entryPoints ?? [];
  return [
    'This view is a WHOLE-GRAPH DASHBOARD: it is NOT bound to one concept.',
    '- Its queries may start from ANY root query field below, and combine several concepts in one dashboard.',
    '- Declare one named query per entry point you use (several root fields may also share one query document).',
    '- Only pass a row-limit argument when the entry point has one, always through a variable named exactly $take (e.g. "<field>(take: $take)" with "variables": { "take": 200 }), never as a literal: fluid sets $take from the source settings.',
    '- Add "linkTo" with the row\'s concept on id / name columns so each row opens in a Miller column.',
    '- Use the fields of the "Reachable relations" section for nested selections below an entry point.',
    'Entry points (concept: root queries; scalar fields):',
    entries.length ? entries.map(describeEntryPoint).join('\n') : '  (none)',
  ].join('\n');
}

/**
 * Deterministic graph dashboard for the offline mock: a count per entry point
 * with a list query, and a table of the first one.
 */
export function mockGraphDraft(schema: ConceptSchemaInfo, prompt: string): ViewSpecDraft {
  const listed = (schema.entryPoints ?? []).filter((e) => e.listQuery && e.fields.length).slice(0, 4);
  const queries: ViewSpecDraft['queries'] = {};
  const widgets: ViewSpecDraft['widgets'] = [];
  const span = listed.length ? Math.max(6, Math.floor(24 / listed.length)) : 24;

  listed.forEach((entry, index) => {
    const key = `q${index}`;
    const names = entry.fields.map((f) => f.split(':')[0].trim());
    // Rows open by the by-id query's key (`id`, or e.g. `code`).
    const idKey = entry.byIdArgName ?? 'id';
    const selection = [...new Set([idKey, ...names.slice(0, 4)])].filter((n) => names.includes(n)).join(' ');
    const varDecl = entry.listLimitArg ? '($take: Int)' : '';
    const args = entry.listLimitArg ? `(${entry.listLimitArg}: $take)` : '';
    const body = entry.listItemsPath ? `${entry.listItemsPath} { ${selection} }` : selection;
    queries[key] = {
      query: `query Graph_${entry.concept}${varDecl} { ${entry.listQuery}${args} { ${body} } }`,
      variables: entry.listLimitArg ? { take: 200 } : {},
    };
    const path = entryRowsPath(entry);
    widgets.push({ id: `count-${index}`, type: 'statistic', title: entry.concept, span, data: { query: key, path }, value: { op: 'count' } });
    if (index === 0) {
      widgets.push({
        id: 'list',
        type: 'table',
        title: entry.concept,
        span: 24,
        pageSize: 10,
        data: { query: key, path },
        columns: selection.split(' ').map((name) => ({
          key: name,
          title: name,
          ...(name === idKey && entry.byIdQuery ? { linkTo: { concept: entry.concept, idField: idKey } } : {}),
        })),
      });
    }
  });

  // Counts first, then the table.
  widgets.sort((a, b) => Number(a.type === 'table') - Number(b.type === 'table'));
  return {
    title: 'Graph overview',
    description: `Mock-generated dashboard across the graph. Prompt: ${prompt}`.slice(0, 200),
    queries,
    widgets,
  };
}
