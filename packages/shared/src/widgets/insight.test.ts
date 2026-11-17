import { describe, expect, it } from 'vitest';
import { safeParseWidgetDraft, widgetSchema } from '../view-spec';
import { analyzeViewRequestSchema, INSIGHT_MAX_SOURCES, insightAnalysisSchema } from './insightAnalysis';

describe('insight widget schema', () => {
  it('accepts the widget with or without sources, focus and data', () => {
    expect(widgetSchema.safeParse({ id: 'a', type: 'insight' }).success).toBe(true);
    const full = { id: 'a', type: 'insight', sources: ['t'], focus: 'why?', data: { query: 'q' } };
    expect(widgetSchema.parse(full)).toEqual(full);
    expect(safeParseWidgetDraft({ type: 'insight', focus: 'why?' }).success).toBe(true);
  });

  it('rejects bad sources and an empty focus', () => {
    expect(widgetSchema.safeParse({ id: 'a', type: 'insight', sources: 't' }).success).toBe(false);
    expect(widgetSchema.safeParse({ id: 'a', type: 'insight', focus: '' }).success).toBe(false);
  });
});

describe('analyzeViewRequestSchema', () => {
  const source = { id: 't', type: 'table', data: [] };
  const request = { view: { title: 'T', concept: 'C' }, sources: [source] };

  it('accepts up to the maximum number of sources', () => {
    expect(analyzeViewRequestSchema.parse(request)).toEqual(request);
    const many = { ...request, sources: Array.from({ length: INSIGHT_MAX_SOURCES + 1 }, () => source) };
    expect(analyzeViewRequestSchema.safeParse(many).success).toBe(false);
  });
});

describe('insightAnalysisSchema', () => {
  it('defaults the findings and keeps the questions', () => {
    expect(insightAnalysisSchema.parse({ verdict: 'nothing', questions: ['q?'] })).toEqual({
      verdict: 'nothing',
      findings: [],
      questions: ['q?'],
    });
  });

  it('falls back to info for an unknown severity, rejects a finding without a title', () => {
    const finding = { kind: 'gap', severity: 'huge', title: 't', detail: 'd' };
    expect(insightAnalysisSchema.parse({ verdict: 'insights', findings: [finding] }).findings[0].severity).toBe('info');
    const untitled = { verdict: 'insights', findings: [{ ...finding, title: '' }] };
    expect(insightAnalysisSchema.safeParse(untitled).success).toBe(false);
  });
});
