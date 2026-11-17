import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewScope, ViewSpec } from '@fluid/shared';
import type { ChatMessage, ConceptSchemaPayload } from '../../bff/client';
import { useLlmGenerate, type ViewSeed } from '../../entities/llm';
import { useAssistantChats, type AssistantTurn } from '../../store';
import { appendDelta, buildHistory, sessionKeyOf, specsByVersion, versionTurns, type LiveOutput } from './model';

const EMPTY_TURNS: AssistantTurn[] = [];

export interface AssistantTarget {
  concept: string;
  schema: ConceptSchemaPayload;
  /** List or detail column the view is made for. */
  scope?: ViewScope;
  /** Item the column was opened on: the preview reads its data. */
  itemId?: string;
  /** Concept query reading one item by id (receives `itemId`). */
  byIdField?: string;
}

/** A prompt sent to the model whose answer has not arrived yet. */
export interface PendingPrompt {
  prompt: string;
  basedOn: number | null;
}

/**
 * A persisted conversation with the view assistant: its turns numbered as spec
 * versions, the version shown (and refined by the next prompt), and the
 * in-flight generation with its live output. The generation is aborted when
 * the owner unmounts.
 */
export function useAssistantSession(
  { concept, schema, scope }: AssistantTarget,
  editingViewId?: string,
  initialSpec?: ViewSpec,
  seed?: ViewSeed,
) {
  const effectiveScope = initialSpec?.scope ?? scope;
  const sessionKey = sessionKeyOf(concept, effectiveScope, editingViewId);
  const turns = useAssistantChats((s) => s.sessions[sessionKey]?.turns ?? EMPTY_TURNS);
  const addTurn = useAssistantChats((s) => s.addTurn);
  const clearSession = useAssistantChats((s) => s.clear);
  const { generateView } = useLlmGenerate();

  // Version shown in the preview and refined by the next prompt; null = latest.
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [live, setLive] = useState<LiveOutput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const versions = useMemo(() => versionTurns(turns), [turns]);
  const specs = useMemo(() => specsByVersion(turns, versions, initialSpec), [turns, versions, initialSpec]);
  const latestVersion = specs.size ? Math.max(...specs.keys()) : null;
  const activeVersion = selected !== null && specs.has(selected) ? selected : latestVersion;
  const spec = activeVersion !== null ? (specs.get(activeVersion) ?? null) : null;

  // Opened from the chat: the conversation so far precedes every prompt, and the first one is sent at once.
  const seedHistory = seed?.history;
  const run = async (trimmed: string, basedOn: number | null, history: ChatMessage[]) => {
    setPending({ prompt: trimmed, basedOn });
    setLive(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const turn: AssistantTurn = { id: crypto.randomUUID(), prompt: trimmed, at: Date.now(), basedOn };
    try {
      const res = await generateView(
        {
          concept,
          schema,
          prompt: trimmed,
          scope: effectiveScope,
          history,
        },
        (delta) => setLive((cur) => appendDelta(cur, delta)),
        controller.signal,
      );
      if (abortRef.current !== controller) return;
      addTurn(sessionKey, { ...turn, spec: res.spec, model: res.model, reasoning: res.reasoning });
      setSelected(null);
    } catch (err) {
      // Superseded by a newer run (a remount of the seeded modal): nothing to report.
      if (abortRef.current !== controller) return;
      addTurn(sessionKey, { ...turn, error: controller.signal.aborted ? 'Stopped.' : (err as Error).message });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(null);
        setLive(null);
      }
    }
  };

  const generate = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || pending) return;
    const history = [...(seedHistory ?? []), ...buildHistory(turns, versions, activeVersion ?? 0, initialSpec)];
    return run(trimmed, activeVersion, history);
  };

  // A fresh conversation per seed: the earlier assistant exchanges would muddy the chat's.
  useEffect(() => {
    if (!seed) return;
    clearSession(sessionKey);
    void run(seed.prompt, null, seed.history);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    clearSession(sessionKey);
    setSelected(null);
  }, [clearSession, sessionKey]);

  return {
    turns,
    versions,
    specs,
    latestVersion,
    activeVersion,
    spec,
    pending,
    live,
    select: setSelected,
    generate,
    stop,
    clear,
  };
}

export type AssistantSession = ReturnType<typeof useAssistantSession>;
