import { lazy } from 'react';

// three.js is only loaded when a view shows a 3D widget.
export const LazyModel3dWidget = lazy(() => import('./Model3dWidget').then((m) => ({ default: m.Model3dWidget })));
export const LazyScene3dWidget = lazy(() => import('./Scene3dWidget').then((m) => ({ default: m.Scene3dWidget })));
