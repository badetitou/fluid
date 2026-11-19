import { makeErrorResult, makeResult, type Exchange, type Operation, type OperationResult } from '@urql/core';
import { print } from 'graphql';
import { filter, fromPromise, mergeMap, pipe } from 'wonka';
import type { ViewerData } from './viewerData';

/** Runs the view action whose mutation this is (`invoke_action`); rejects when none matches. */
export type InvokeMutationFn = (mutation: string, variables: Record<string, unknown>) => Promise<{ data?: unknown; errors?: unknown[] }>;

const messageOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : String(error);

async function resultOf(op: Operation, data: ViewerData, invoke?: InvokeMutationFn): Promise<OperationResult> {
  if (op.kind === 'mutation' && !invoke) return makeErrorResult(op, new Error('Changes are not available in this host.'));
  if (op.kind !== 'query' && op.kind !== 'mutation') return makeErrorResult(op, new Error('Not available in this host.'));
  try {
    const variables = op.variables as Record<string, unknown> | undefined;
    const answer = op.kind === 'mutation' && invoke ? await invoke(print(op.query), variables ?? {}) : await data.answer(print(op.query), variables);
    return makeResult(op, {
      data: answer.data as Record<string, unknown> | undefined,
      errors: answer.errors?.map((e) => ({ message: messageOf(e) })),
    });
  } catch (err) {
    return makeErrorResult(op, err instanceof Error ? err : new Error(String(err)));
  }
}

/** Terminal exchange of the viewer: no network; queries are answered by `ViewerData`, mutations by `invoke`. */
export const viewerExchange =
  (data: ViewerData, invoke?: InvokeMutationFn): Exchange =>
  () =>
  (operations$) =>
    pipe(
      operations$,
      filter((op) => op.kind !== 'teardown'),
      mergeMap((op) => fromPromise(resultOf(op, data, invoke))),
    );
