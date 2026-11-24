import { lazy } from 'react';

// React Flow (and its stylesheet) is only loaded when a view shows a graph explorer.
import '@xyflow/react/dist/style.css';

export const LazyGraphExplorerWidget = lazy(() =>
  import('./GraphExplorerWidget').then((m) => ({ default: m.GraphExplorerWidget })),
);
