import { makeErrorResult, makeResult, type Exchange, type Operation, type OperationResult } from '@urql/core';
import { print } from 'graphql';
import { filter, fromPromise, mergeMap, pipe } from 'wonka';
import type { ViewerData } from './viewerData';

const messageOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : String(error);

async function resultOf(op: Operation, data: ViewerData): Promise<OperationResult> {
  if (op.kind !== 'query') return makeErrorResult(op, new Error('Changes are not available in this host.'));
  try {
    const answer = await data.answer(print(op.query), op.variables as Record<string, unknown> | undefined);
    return makeResult(op, {
      data: answer.data as Record<string, unknown> | undefined,
      errors: answer.errors?.map((e) => ({ message: messageOf(e) })),
    });
  } catch (err) {
    return makeErrorResult(op, err instanceof Error ? err : new Error(String(err)));
  }
}

/** Terminal exchange of the viewer: no network, every query is answered by `ViewerData`. */
export const viewerExchange =
  (data: ViewerData): Exchange =>
  () =>
  (operations$) =>
    pipe(
      operations$,
      filter((op) => op.kind !== 'teardown'),
      mergeMap((op) => fromPromise(resultOf(op, data))),
    );
