import { createContext, useContext } from 'react';
import type { AnalyzeViewRequest, InsightAnalysis, ViewSpec } from '@fluid/shared';

/**
 * Analyses what a view's widgets show (the insight widget). Provided by the app,
 * which knows the LLM settings; null without a provider: the widget says so.
 */
export type InsightAnalyzer = (request: AnalyzeViewRequest, signal?: AbortSignal) => Promise<InsightAnalysis>;

export const InsightAnalyzerContext = createContext<InsightAnalyzer | null>(null);

export const useInsightAnalyzer = (): InsightAnalyzer | null => useContext(InsightAnalyzerContext);

/** The view being rendered, for widgets that look at the others (the insight widget). */
export const RenderedViewContext = createContext<ViewSpec | null>(null);

export const useRenderedView = (): ViewSpec | null => useContext(RenderedViewContext);
