import { lazy } from 'react';

// The explorer only mounts sigma (already used by `network`) and a small 2D
// canvas layer; no graph library stylesheet is needed.
export const LazyGraphExplorerWidget = lazy(() =>
  import('./GraphExplorerWidget').then((m) => ({ default: m.GraphExplorerWidget })),
);
