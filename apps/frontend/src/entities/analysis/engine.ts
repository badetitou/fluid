// The in-browser Model engine as fluid sees it: build a model from files, answer GraphQL.
// The implementation is Model's WebAssembly module, run in a worker (`analysis.worker.ts`).

/** A file of the repository: path relative to its root, raw bytes. */
export interface SourceFile {
  path: string;
  data: Uint8Array;
}

export interface GraphqlRequest {
  query: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

export interface ModelEngine {
  /** Runs one GraphQL request on the model; resolves with the response body (`{ data, errors }`). */
  execute: (request: GraphqlRequest) => Promise<unknown>;
  /** Frees the model and stops the worker. */
  dispose: () => void;
}

export type EngineBuilder = (
  files: SourceFile[],
  signal: AbortSignal,
  onProgress: (message: string) => void,
) => Promise<ModelEngine>;

/** Messages between the page and `analysis.worker.ts`. */
export type WorkerRequest =
  | { type: 'build'; wasmUrl: string; files: SourceFile[] }
  | { type: 'execute'; id: number; request: GraphqlRequest };

export type WorkerResponse =
  | { type: 'progress'; message: string }
  | { type: 'built' }
  | { type: 'result'; id: number; body: unknown }
  | { type: 'error'; id?: number; message: string };
