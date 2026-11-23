import type { WorkerRequest, WorkerResponse } from './engine';

// Runs Model's WebAssembly module off the main thread (indexing a repository takes seconds).
// Contract of the module (`model_wasm.js`, built from badetitou/Model with wasm-bindgen):
//   default export  init(): Promise<unknown>
//   class ModelSession { constructor(); add_file(path, content); build(); execute(json): string; free() }
// See docs/guides/browser-analysis.md.

interface ModelSession {
  add_file: (path: string, content: string) => void;
  build: () => void;
  execute: (requestJson: string) => string;
  free: () => void;
}
interface ModelWasm {
  default: () => Promise<unknown>;
  ModelSession: new () => ModelSession;
}

const send = (message: WorkerResponse) => postMessage(message);
const decoder = new TextDecoder();
let session: ModelSession | undefined;

async function build(wasmUrl: string, files: { path: string; data: Uint8Array }[]) {
  const wasm = (await import(/* @vite-ignore */ wasmUrl)) as ModelWasm;
  send({ type: 'progress', message: 'Loading Model…' });
  await wasm.default();
  session = new wasm.ModelSession();
  send({ type: 'progress', message: `Reading ${files.length} files…` });
  for (const file of files) session.add_file(file.path, decoder.decode(file.data));
  send({ type: 'progress', message: 'Building the model…' });
  session.build();
  send({ type: 'built' });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === 'build') await build(message.wasmUrl, message.files);
    else if (session) send({ type: 'result', id: message.id, body: JSON.parse(session.execute(JSON.stringify(message.request))) });
    else send({ type: 'error', id: message.id, message: 'The model is not built yet.' });
  } catch (err) {
    send({ type: 'error', id: message.type === 'execute' ? message.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
