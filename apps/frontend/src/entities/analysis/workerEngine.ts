import { MODEL_WASM_URL } from '../../runtime-config';
import type { EngineBuilder, GraphqlRequest, ModelEngine, WorkerResponse } from './engine';

/** Builds the model in a dedicated worker; resolves once the WebAssembly module answers `built`. */
export const buildWorkerEngine: EngineBuilder = (files, signal, onProgress) =>
  new Promise<ModelEngine>((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const pending = new Map<number, { resolve: (body: unknown) => void; reject: (err: Error) => void }>();
    let next = 0;
    const fail = (err: Error) => {
      worker.terminate();
      pending.forEach((p) => p.reject(err));
      pending.clear();
      reject(err);
    };
    const engine: ModelEngine = {
      execute: (request: GraphqlRequest) =>
        new Promise((res, rej) => {
          const id = ++next;
          pending.set(id, { resolve: res, reject: rej });
          worker.postMessage({ type: 'execute', id, request });
        }),
      dispose: () => fail(new Error('The model was closed.')),
    };

    // Cancelling only matters while building: once resolved, the engine outlives the page that asked.
    const cancel = () => fail(new Error('Analysis cancelled.'));
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = (event) => fail(new Error(event.message || 'The analysis worker failed.'));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') onProgress(message.message);
      else if (message.type === 'built') {
        signal.removeEventListener('abort', cancel);
        resolve(engine);
      }
      else if (message.type === 'result') {
        pending.get(message.id)?.resolve(message.body);
        pending.delete(message.id);
      } else if (message.id !== undefined) {
        pending.get(message.id)?.reject(new Error(message.message));
        pending.delete(message.id);
      } else fail(new Error(message.message));
    };
    worker.postMessage(
      { type: 'build', wasmUrl: MODEL_WASM_URL, files },
      files.map((f) => f.data.buffer),
    );
  });
