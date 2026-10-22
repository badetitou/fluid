import { useEffect, useMemo, useState } from 'react';
import { useClient } from 'urql';
import {
  buildInputFields,
  inputTypeQuery,
  type ConceptMutations,
  type InputField,
  type InputTypeResult,
} from '../../graphql/introspection';
import { mutationInputTypes } from '../../llm/conceptSchema';
import { useRootConcepts } from '../../hooks/useConcepts';

const NONE = new Map<string, InputField[]>();

/**
 * The fields of the input objects a concept's mutations take (`UpdateTodoInput`
 * → title, completed), introspected on demand: the LLM is told what it can write.
 */
export function useMutationInputs(mutations: ConceptMutations | undefined): ReadonlyMap<string, InputField[]> {
  const client = useClient();
  const { depth } = useRootConcepts();
  const [byType, setByType] = useState<ReadonlyMap<string, InputField[]>>(NONE);
  const key = useMemo(() => mutationInputTypes(mutations).join(','), [mutations]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const names = key.split(',');
    Promise.all(names.map((name) => client.query<InputTypeResult>(inputTypeQuery(depth), { name }).toPromise())).then(
      (results) => {
        if (cancelled) return;
        setByType(new Map(names.map((name, i) => [name, buildInputFields(results[i].data?.__type ?? null)])));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, depth, key]);

  return key ? byType : NONE;
}
