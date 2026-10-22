// Root mutations, attached to the concepts they write. A mutation belongs to the
// concept it returns or, when it returns a scalar (`deleteTodo: Boolean`), to
// the concept its name ends with. Its kind comes from the verb its name starts
// with. See docs/architecture/MUTATIONS.md §4.

import type {
  ConceptMutation,
  ConceptMutations,
  InputField,
  IntrospectionField,
  IntrospectionInputType,
  IntrospectionType,
  MutationArg,
} from './introspectionTypes';
import { splitMutationName } from '@fluid/shared';
import { typeRefToString, unwrapType } from './introspectionTypes';

/** A shallow introspection hides argument types: `input` is then the usual name of the input object. */
const INPUT_ARG_NAMES = ['input', 'data'];

/** The concept a name designates, ignoring case and a trailing plural `s`. */
function matchConcept(subject: string, concepts: ReadonlySet<string>): string | undefined {
  const lower = subject.toLowerCase();
  for (const name of concepts) {
    const candidate = name.toLowerCase();
    if (lower === candidate || lower === `${candidate}s`) return name;
  }
  return undefined;
}

function toArg(arg: IntrospectionField['args'][number]): MutationArg {
  const u = arg.type ? unwrapType(arg.type) : undefined;
  const isInput = u?.kind === 'INPUT_OBJECT' || (!u?.name && INPUT_ARG_NAMES.includes(arg.name));
  return {
    name: arg.name,
    type: typeRefToString(arg.type),
    typeName: u?.name ?? undefined,
    required: arg.type?.kind === 'NON_NULL',
    isInput,
  };
}

/** `id` when present, otherwise the only required argument that is not the input object. */
function idArgOf(args: MutationArg[]): string | undefined {
  if (args.some((a) => a.name === 'id')) return 'id';
  const keys = args.filter((a) => a.required && !a.isInput);
  return keys.length === 1 ? keys[0].name : undefined;
}

/** Classify one root mutation field; null when it writes none of the known concepts. */
export function classifyMutation(
  field: IntrospectionField,
  concepts: ReadonlySet<string>,
): { concept: string; mutation: ConceptMutation } | null {
  const { kind, subject } = splitMutationName(field.name);
  const returned = unwrapType(field.type);
  const returnsConcept = returned.kind === 'OBJECT' && !!returned.name && concepts.has(returned.name);
  const concept = returnsConcept ? returned.name! : matchConcept(subject, concepts);
  if (!concept) return null;

  const args = field.args.map(toArg);
  const inputs = args.filter((a) => a.isInput);
  return {
    concept,
    mutation: {
      field: field.name,
      kind,
      args,
      ...(kind === 'update' || kind === 'delete' ? { idArg: idArgOf(args) } : {}),
      ...(inputs.length === 1 ? { inputArg: inputs[0].name } : {}),
      returnsConcept,
    },
  };
}

/**
 * Attach every field of the root Mutation type to the concept it writes. The
 * first mutation of each kind is the concept's create / update / delete; the
 * others, and the mutations of no known kind, are kept in `others`.
 */
export function buildRootMutations(
  mutationType: IntrospectionType | null,
  concepts: ReadonlySet<string>,
): Map<string, ConceptMutations> {
  const byConcept = new Map<string, ConceptMutations>();
  for (const field of mutationType?.fields ?? []) {
    const classified = classifyMutation(field, concepts);
    if (!classified) continue;
    const { concept, mutation } = classified;
    const entry = byConcept.get(concept) ?? { others: [] };
    byConcept.set(concept, entry);
    if (mutation.kind !== 'other' && !entry[mutation.kind]) entry[mutation.kind] = mutation;
    else entry.others.push(mutation);
  }
  return byConcept;
}

/** The fields of an input object type; empty when the type is not one. */
export function buildInputFields(type: IntrospectionInputType | null): InputField[] {
  if (type?.kind !== 'INPUT_OBJECT') return [];
  return (type.inputFields ?? []).map((f) => {
    const u = unwrapType(f.type);
    return {
      name: f.name,
      description: f.description,
      type: typeRefToString(f.type),
      typeName: u.name ?? 'Unknown',
      typeKind: u.kind,
      isList: u.isList,
      required: f.type.kind === 'NON_NULL',
    };
  });
}
