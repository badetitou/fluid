import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { characterInsightExample, type InsightAnalysis, type InsightWidget as InsightWidgetSpec } from '@fluid/shared';
import { resolveBinding } from '../../data';
import { InsightAnalyzerContext, RenderedViewContext, type InsightAnalyzer } from '../../plugin-api/insightContext';
import { InsightWidget } from './InsightWidget';
import { clearInsightCache } from './useInsight';

const view = characterInsightExample;
const widget = view.widgets.find((w) => w.type === 'insight') as InsightWidgetSpec;
const rows = [
  { id: '1', name: 'Rick Sanchez', species: 'Human', status: 'Alive' },
  { id: '2', name: 'Abradolf Lincler', species: 'Human', status: 'unknown' },
  { id: '3', name: 'Squanchy', species: 'Alien', status: 'Dead' },
];
const results = { characters: { characters: { results: rows } } };
const resolve = (b: Parameters<typeof resolveBinding>[0]) => resolveBinding(b, results);

const findings: InsightAnalysis = {
  verdict: 'insights',
  headline: 'Aliens die more often than humans',
  findings: [
    {
      kind: 'correlation',
      severity: 'notable',
      title: 'Every alien is dead',
      detail: 'Species and status go together.',
      evidence: ['1 of 1 aliens'],
    },
  ],
  questions: ['Does the origin matter too?'],
};

function show(analyze: InsightAnalyzer | null, spec = widget) {
  return render(
    <InsightAnalyzerContext.Provider value={analyze}>
      <RenderedViewContext.Provider value={view}>
        <InsightWidget widget={spec} resolve={resolve} />
      </RenderedViewContext.Provider>
    </InsightAnalyzerContext.Provider>,
  );
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  clearInsightCache();
});

describe('InsightWidget', () => {
  it('sends what the other widgets show and renders the findings', async () => {
    const analyze = vi.fn<InsightAnalyzer>().mockResolvedValue(findings);
    show(analyze);
    expect(await screen.findByText('Every alien is dead')).toBeTruthy();
    expect(screen.getByText('Aliens die more often than humans')).toBeTruthy();
    expect(screen.getByText('1 of 1 aliens')).toBeTruthy();
    expect(screen.getByText('Does the origin matter too?')).toBeTruthy();
    const [request] = analyze.mock.calls[0];
    expect(request.focus).toBe(widget.focus);
    expect(request.sources.map((s) => s.id)).toEqual(['species', 'roster']);
  });

  it('says hello when there is nothing more to tell', async () => {
    show(vi.fn<InsightAnalyzer>().mockResolvedValue({ verdict: 'nothing', findings: [] }));
    expect(await screen.findByText('Hello :)')).toBeTruthy();
  });

  it('does not ask again for the same data, unless asked to', async () => {
    const analyze = vi.fn<InsightAnalyzer>().mockResolvedValue(findings);
    show(analyze);
    await screen.findByText('Every alien is dead');
    cleanup();
    show(analyze);
    await screen.findByText('Every alien is dead');
    expect(analyze).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Analyse again' }));
    await screen.findByText('Every alien is dead');
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('shows the error and retries', async () => {
    const analyze = vi.fn<InsightAnalyzer>().mockRejectedValueOnce(new Error('No model')).mockResolvedValue(findings);
    show(analyze);
    expect(await screen.findByText('No model')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Every alien is dead')).toBeTruthy();
  });

  it('explains that it needs the LLM without an analyser', () => {
    show(null);
    expect(screen.getByText('The AI analysis needs the LLM settings of the app.')).toBeTruthy();
  });

  it('says hello without anything to analyse', () => {
    const analyze = vi.fn<InsightAnalyzer>();
    show(analyze, { ...widget, sources: ['missing'] });
    expect(screen.getByText('Hello :)')).toBeTruthy();
    expect(analyze).not.toHaveBeenCalled();
  });
});
