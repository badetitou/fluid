import { lazy } from 'react';

// prism is only loaded when a view shows code.
export const LazyCodeWidget = lazy(() => import('./CodeWidget').then((m) => ({ default: m.CodeWidget })));
