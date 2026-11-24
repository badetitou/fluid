import { useSyncExternalStore } from 'react';
import { getBrowserLlmStatus, subscribeBrowserLlmStatus } from '../../llm/browser/browserEngine';

/** Progress of the WebGPU model: downloading, ready, or failed. */
export function useBrowserLlmStatus() {
  return useSyncExternalStore(subscribeBrowserLlmStatus, getBrowserLlmStatus, getBrowserLlmStatus);
}
