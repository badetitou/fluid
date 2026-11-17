import { createContext, useContext } from 'react';
import type { AnalyzeViewRequest, InsightAnalysis } from '@fluid/shared';

/**
 * Analyses what a view's widgets show (the insight widget). Provided by the app,
 * which knows the LLM settings; null without a provider: the widget says so.
 * The app hands a new function when the settings change.
 */
export type InsightAnalyzer = (request: AnalyzeViewRequest, signal?: AbortSignal) => Promise<InsightAnalysis>;

export const InsightAnalyzerContext = createContext<InsightAnalyzer | null>(null);

export const useInsightAnalyzer = (): InsightAnalyzer | null => useContext(InsightAnalyzerContext);
