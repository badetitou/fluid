import { lazy } from 'react';

// sigma, graphology, ForceAtlas2 and the dagre worker are only loaded when a view shows a network.
export const LazyNetworkWidget = lazy(() => import('./NetworkWidget').then((m) => ({ default: m.NetworkWidget })));
