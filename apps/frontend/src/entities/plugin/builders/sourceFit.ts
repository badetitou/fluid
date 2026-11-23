import { Kind, parse, type OperationDefinitionNode } from 'graphql';
import type { ViewSpec } from '@fluid/shared';
import type { IntrospectionType } from '../../../graphql/introspection';

// Whether a view written for one source fits the connected one. Example views are keyed by concept
// name only, so a source with a `Class` concept (Moose, badetitou/Model…) would be offered views whose
// queries it cannot answer. The check is cheap and only reads the root type fluid already introspects:
// every root field a query selects must exist, with every argument it passes.

/** Root query fields of a source and the names of their arguments. */
export type RootFields = ReadonlyMap<string, ReadonlySet<string>>;

/** The root fields of an introspected root Query type. */
export function rootFieldsOf(rootType: IntrospectionType | null): RootFields | undefined {
  if (!rootType?.fields) return undefined;
  return new Map(rootType.fields.map((f) => [f.name, new Set(f.args.map((a) => a.name))]));
}

function operationFits(operation: OperationDefinitionNode, rootFields: RootFields): boolean {
  return operation.selectionSet.selections.every((selection) => {
    if (selection.kind !== Kind.FIELD) return true;
    const name = selection.name.value;
    if (name.startsWith('__')) return true;
    const args = rootFields.get(name);
    return args !== undefined && (selection.arguments ?? []).every((a) => args.has(a.name.value));
  });
}

/** Every query of the view selects root fields (and arguments) the source has. */
export function fitsSource(spec: ViewSpec, rootFields: RootFields): boolean {
  return Object.values(spec.queries).every(({ query }) => {
    try {
      return parse(query).definitions.every((d) => d.kind !== Kind.OPERATION_DEFINITION || operationFits(d, rootFields));
    } catch {
      return false;
    }
  });
}
