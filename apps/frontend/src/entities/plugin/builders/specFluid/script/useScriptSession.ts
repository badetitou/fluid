import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpecFluidEvaluation, SpecFluidRef } from '@fluid/shared';
import { OpenableConceptsContext, useNavigationHref } from '../../../../../navigation/columnPath';
import { evaluate } from '../api';
import { openableScriptConcept } from './model';

/** The code the editor starts with, as in the Script button of the Moose inspector. */
export const INITIAL_CODE = 'self ';

export type ScriptRun =
  | { status: 'idle' }
  | { status: 'running' }
  /** `opened`: the result is an entity, now shown in the next column. */
  | { status: 'done'; result: SpecFluidEvaluation; opened: boolean }
  | { status: 'error'; message: string };

/**
 * The Smalltalk typed in the script panel and its last run, evaluated by the
 * image with the column's entity as `self`. A result naming an entity that can
 * be opened moves the navigation on: the entity opens in the next column.
 */
export function useScriptSession(endpoint: string, itemId: string) {
  const navigate = useNavigate();
  const hrefFor = useNavigationHref();
  const openable = useContext(OpenableConceptsContext);
  const [code, setCode] = useState(INITIAL_CODE);
  const [run, setRun] = useState<ScriptRun>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const hrefOf = useCallback(
    (ref: SpecFluidRef | undefined) => {
      const concept = openableScriptConcept(ref, openable);
      return concept && ref ? hrefFor(concept, ref.id) : undefined;
    },
    [hrefFor, openable],
  );

  const execute = useCallback(() => {
    if (!code.trim()) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setRun({ status: 'running' });
    evaluate(endpoint, itemId, code, current.signal).then(
      (result) => {
        if (current.signal.aborted) return;
        const href = hrefOf(result.ref);
        if (href) navigate(href);
        setRun({ status: 'done', result, opened: href !== undefined });
      },
      (error: unknown) => {
        if (current.signal.aborted) return;
        setRun({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      },
    );
  }, [code, endpoint, itemId, hrefOf, navigate]);

  return useMemo(() => ({ code, setCode, run, execute, hrefOf }), [code, run, execute, hrefOf]);
}
