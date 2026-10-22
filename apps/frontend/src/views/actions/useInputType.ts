import { useMemo } from 'react';
import { useQuery } from 'urql';
import { buildInputFields, inputTypeQuery, type InputField, type InputTypeResult } from '../../graphql/introspection';

/**
 * The fields of an input object type (a mutation's `input` argument), read on
 * demand and cached by urql. Introspected deeply, then shallowly when the
 * source rejects the deep query (depth limits). Undefined while loading or
 * without a type name; empty when the type is not an input object.
 */
export function useInputType(typeName: string | undefined): InputField[] | undefined {
  const [deep] = useQuery<InputTypeResult>({
    query: inputTypeQuery('deep'),
    variables: { name: typeName ?? '' },
    pause: !typeName,
  });
  const [shallow] = useQuery<InputTypeResult>({
    query: inputTypeQuery('shallow'),
    variables: { name: typeName ?? '' },
    pause: !typeName || !deep.error,
  });
  const result = deep.error ? shallow : deep;
  return useMemo(
    () => (result.data ? buildInputFields(result.data.__type) : result.error ? [] : undefined),
    [result.data, result.error],
  );
}
