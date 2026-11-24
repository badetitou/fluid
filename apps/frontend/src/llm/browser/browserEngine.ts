import type { ChatMessage } from '@fluid/shared';
import type { LlmDelta } from '../../bff/client';

export const BROWSER_DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export interface BrowserLlmStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  text: string;
  model: string | null;
}

let status: BrowserLlmStatus = { state: 'idle', progress: 0, text: '', model: null };
const listeners = new Set<() => void>();

export function getBrowserLlmStatus(): BrowserLlmStatus {
  return status;
}

export function subscribeBrowserLlmStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(patch: Partial<BrowserLlmStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}

/** Feature detection: WebGPU needs a recent Chromium browser and a secure context. */
export function browserSupport(): { supported: boolean; reason?: string } {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { supported: false, reason: 'Browser generation needs a web page (not a server).' };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'WebGPU requires HTTPS (or localhost) — open fluid over a secure origin.' };
  }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) {
    return { supported: false, reason: 'WebGPU is not available in this browser. Use a recent Chrome or Edge.' };
  }
  return { supported: true };
}

export function browserModel(model: string): string {
  return model.trim() || BROWSER_DEFAULT_MODEL;
}

interface CompletionChunk {
  choices: Array<{ delta?: { content?: string | null } }>;
}
interface Engine {
  chat: {
    completions: {
      create(request: {
        model: string;
        messages: ChatMessage[];
        temperature: number;
        max_tokens: number;
        stream: true;
      }): Promise<AsyncIterable<CompletionChunk>>;
    };
  };
}
type EngineFactory = (
  worker: Worker,
  model: string,
  config: { initProgressCallback: (report: { progress: number; text: string }) => void },
) => Promise<Engine>;

let engine: Promise<Engine> | null = null;
let loadedModel: string | null = null;
let worker: Worker | null = null;

function stopWorker(): void {
  worker?.terminate();
  worker = null;
  engine = null;
  loadedModel = null;
}

async function loadEngine(model: string): Promise<Engine> {
  if (engine && loadedModel === model) return engine;
  const support = browserSupport();
  if (!support.supported) throw new Error(support.reason);
  stopWorker();
  publish({ state: 'loading', progress: 0, text: 'Downloading the model…', model });

  try {
    const webllm = await import('@mlc-ai/web-llm');
    const createEngine = webllm.CreateWebWorkerMLCEngine as unknown as EngineFactory;
    worker = new Worker(new URL('./webLlmWorker.ts', import.meta.url), { type: 'module' });
    loadedModel = model;
    engine = createEngine(worker, model, {
      initProgressCallback: (report) =>
        publish({ state: 'loading', progress: report.progress, text: report.text, model }),
    }).then(
      (ready) => {
        publish({ state: 'ready', progress: 1, text: 'Model ready', model });
        return ready;
      },
      (err: unknown) => {
        publish({ state: 'error', text: (err as Error).message, model });
        stopWorker();
        throw err;
      },
    );
    return engine;
  } catch (err) {
    publish({ state: 'error', text: (err as Error).message, model });
    stopWorker();
    throw err;
  }
}

/** One local completion. The library has no abort signal; we stop reading on abort. */
export async function browserComplete(
  model: string,
  messages: ChatMessage[],
  onDelta?: (delta: LlmDelta) => void,
  signal?: AbortSignal,
): Promise<string> {
  const ready = await loadEngine(model);
  const stream = await ready.chat.completions.create({
    model,
    messages,
    temperature: 0.2,
    max_tokens: 2048,
    stream: true,
  });
  let text = '';
  for await (const chunk of stream) {
    if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      text += delta;
      onDelta?.({ kind: 'text', text: delta });
    }
  }
  if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
  return text;
}
