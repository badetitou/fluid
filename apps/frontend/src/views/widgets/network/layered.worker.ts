import { layeredRequestSchema } from './layoutModel';
import { layeredPositions } from './layeredLayout';

// Web worker computing the layered layout off the main thread (dagre is
// synchronous and slow on thousands of nodes). Invalid requests are ignored.

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = layeredRequestSchema.safeParse(event.data);
  if (request.success) self.postMessage(layeredPositions(request.data));
});
