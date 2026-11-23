import type { ModelEngine } from './engine';

// The engines running in this page, by virtual URL (`model-wasm://owner/name`). The GraphQL client
// of such a URL answers from here instead of the network (see `engineFetch.ts`).

const engines = new Map<string, ModelEngine>();

export function registerEngine(url: string, engine: ModelEngine): void {
  engines.get(url)?.dispose();
  engines.set(url, engine);
}

export const engineFor = (url: string): ModelEngine | undefined => engines.get(url);

export function releaseEngine(url: string): void {
  engines.get(url)?.dispose();
  engines.delete(url);
}
