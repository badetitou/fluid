import { createContext, useContext } from 'react';
import type { ViewSpec } from '@fluid/shared';

/** The view being rendered, for widgets that look at the others (e.g. the insight widget). */
export const RenderedViewContext = createContext<ViewSpec | null>(null);

export const useRenderedView = (): ViewSpec | null => useContext(RenderedViewContext);
