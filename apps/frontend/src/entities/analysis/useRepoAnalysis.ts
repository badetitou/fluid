import { useEffect, useState } from 'react';
import { useConnection } from '../../store';
import { downloadSources } from './download';
import type { EngineBuilder } from './engine';
import { registerEngine } from './engineRegistry';
import { analysisUrl, type AnalysisRepo } from './repo';
import { buildWorkerEngine } from './workerEngine';

export type AnalysisState =
  | { phase: 'downloading' | 'indexing'; detail?: string }
  | { phase: 'ready' }
  | { phase: 'failed'; error: string };

/**
 * Downloads `target` from GitHub, builds its model in the page and connects fluid to it. Starts over
 * when the repository changes; a cancelled run leaves nothing behind.
 */
export function useRepoAnalysis(
  target: AnalysisRepo | null,
  build: EngineBuilder = buildWorkerEngine,
  download: typeof downloadSources = downloadSources,
): AnalysisState {
  const connect = useConnection((s) => s.connect);
  const [state, setState] = useState<AnalysisState>({ phase: 'downloading' });
  const repo = target?.repo;
  const ref = target?.ref;

  useEffect(() => {
    if (!repo) return;
    const wanted: AnalysisRepo = { repo, ...(ref ? { ref } : {}) };
    const controller = new AbortController();
    const { signal } = controller;
    setState({ phase: 'downloading' });
    (async () => {
      const files = await download(wanted, signal, (done, total) =>
        setState({ phase: 'downloading', detail: `${done} / ${total} files` }),
      );
      if (files.length === 0) throw new Error('No Java, TypeScript, Python or Pharo source found in this repository.');
      setState({ phase: 'indexing', detail: `${files.length} files` });
      const engine = await build(files, signal, (detail) => setState({ phase: 'indexing', detail }));
      if (signal.aborted) return engine.dispose();
      const url = analysisUrl(wanted);
      registerEngine(url, engine);
      connect(url);
      setState({ phase: 'ready' });
    })().catch((err: unknown) => {
      if (!signal.aborted) setState({ phase: 'failed', error: err instanceof Error ? err.message : String(err) });
    });
    return () => controller.abort();
  }, [repo, ref, build, download, connect]);

  return state;
}
