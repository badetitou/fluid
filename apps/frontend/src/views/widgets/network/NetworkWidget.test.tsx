import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { characterEpisodesNetworkExample, type NetworkWidget as NetworkWidgetSpec } from '@fluid/shared';
import { BADETITOU_THEME } from '../../../shared/theme';
import { resolveBinding } from '../../data';
import { WidgetThemeContext } from '../../plugin-api/widgetTheme';
import { NetworkWidget } from './NetworkWidget';

// WebGL does not exist in jsdom: sigma is replaced by a fake that records its
// settings and lets the test fire its events. ForceAtlas2's worker likewise.
const sigmas = vi.hoisted(() => [] as FakeSigma[]);
interface FakeSigma {
  settings: Record<string, unknown>;
  graph: { order: number; size: number };
  fire: (event: string, payload?: unknown) => void;
}
vi.mock('sigma', () => {
  class Sigma {
    settings: Record<string, unknown>;
    handlers = new Map<string, (payload: unknown) => void>();
    constructor(
      public graph: { order: number; size: number },
      _container: HTMLElement,
      settings: Record<string, unknown>,
    ) {
      this.settings = { ...settings };
      sigmas.push(this);
    }
    on(event: string, handler: (payload: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload);
    }
    setSettings(settings: Record<string, unknown>) {
      Object.assign(this.settings, settings);
      return this;
    }
    getGraph() {
      return this.graph;
    }
    setGraph(graph: { order: number; size: number }) {
      this.graph = graph;
    }
    resize() {
      return this;
    }
    refresh() {
      return this;
    }
    kill() {}
  }
  return { default: Sigma, Sigma };
});
vi.mock('graphology-layout-forceatlas2/worker', () => ({
  default: class {
    start() {}
    stop() {}
    kill() {}
  },
}));

const spec = characterEpisodesNetworkExample.widgets[0] as NetworkWidgetSpec;
const pilot = { __typename: 'Episode', id: '1', name: 'Pilot', code: 'S01E01', air_date: 'December 2, 2013' };
const dog = { __typename: 'Episode', id: '2', name: 'Lawnmower Dog', code: 'S01E02', air_date: 'December 9, 2013' };
const results = {
  characters: {
    results: [
      { __typename: 'Character', id: '1', name: 'Rick Sanchez', species: 'Human', status: 'Alive', episode: [pilot, dog] },
      { __typename: 'Character', id: '2', name: 'Morty Smith', species: 'Human', status: 'Alive', episode: [pilot] },
      { __typename: 'Character', id: '3', name: 'Snuffles', species: 'Animal', status: 'Alive', episode: [dog] },
    ],
  },
};
const data = resolveBinding(spec.data, { characters: results });

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: NetworkWidgetSpec, rows: unknown = data, emit = vi.fn()) => {
  const view = render(
    <MemoryRouter initialEntries={['/d/Character']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NetworkWidget widget={widget} data={rows} resolve={() => undefined} emit={emit} />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, emit };
};

const sigma = () => sigmas[sigmas.length - 1];

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 400 }) as DOMRect;
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
beforeEach(() => {
  sigmas.length = 0;
});
afterEach(cleanup);

describe('NetworkWidget', () => {
  it('draws the example: characters and their episodes, colored by kind', () => {
    renderWidget(spec);
    expect(sigma().graph).toMatchObject({ order: 5, size: 4 });
    expect(screen.getByText('5 nodes · 4 links')).toBeTruthy();
    expect(screen.getByText('Character')).toBeTruthy();
    expect(screen.getByText('Episode')).toBeTruthy();
    expect(sigma().settings.defaultEdgeType).toBe('arrow');
  });

  it('shows the node’s card on hover, and hides it when leaving', () => {
    renderWidget(spec);
    act(() => sigma().fire('enterNode', { node: 'Pilot', event: { x: 40, y: 50 } }));
    const card = screen.getByRole('tooltip');
    expect(card.textContent).toContain('Pilot');
    expect(card.textContent).toContain('S01E01');
    expect(card.textContent).not.toContain('Species');
    act(() => sigma().fire('leaveNode'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('emits the clicked node and opens it with the link of its group', () => {
    const { emit } = renderWidget(spec);
    act(() => sigma().fire('clickNode', { node: 'Lawnmower Dog' }));
    expect(emit).toHaveBeenCalledWith('selected', dog);
    expect(screen.getByTestId('location').textContent).toMatch(/Episode.*2/);
    act(() => sigma().fire('clickNode', { node: 'Morty Smith' }));
    expect(screen.getByTestId('location').textContent).toMatch(/Character.*2/);
  });

  it('focuses on the neighbourhood of the selection, then shows everything again', () => {
    renderWidget({ ...spec, focusDepth: 1 });
    const focus = screen.getByRole('button', { name: /Focus on selection/ });
    expect((focus as HTMLButtonElement).disabled).toBe(true);
    act(() => sigma().fire('clickNode', { node: 'Snuffles' }));
    fireEvent.click(focus);
    expect(screen.getByText('2 nodes · 1 links')).toBeTruthy();
    expect(sigma().graph).toMatchObject({ order: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Show all/ }));
    expect(screen.getByText('5 nodes · 4 links')).toBeTruthy();
  });

  it('follows the theme without recreating the renderer', () => {
    const { rerender } = render(
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode: 'light', tokens: BADETITOU_THEME.light! }}>
          <NetworkWidget widget={spec} data={data} resolve={() => undefined} emit={() => {}} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>,
    );
    expect(sigma().settings.labelColor).toEqual({ color: BADETITOU_THEME.light!.ink });
    rerender(
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode: 'dark', tokens: BADETITOU_THEME.dark! }}>
          <NetworkWidget widget={spec} data={data} resolve={() => undefined} emit={() => {}} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>,
    );
    expect(sigmas).toHaveLength(1);
    expect(sigma().settings.labelColor).toEqual({ color: BADETITOU_THEME.dark!.ink });
  });

  it('explains why nothing is drawn', () => {
    renderWidget(spec, []);
    expect(screen.getByText('No nodes: the query returned no rows.')).toBeTruthy();
    cleanup();
    renderWidget({ ...spec, idField: 'code' }, [{ name: 'x' }]);
    expect(screen.getByText(/select "code"/)).toBeTruthy();
    expect(sigmas).toHaveLength(0);
  });

  it('says when no link was found', () => {
    renderWidget({ ...spec, linksField: 'friends' });
    expect(screen.getByText('No links: no node lists other nodes in "friends".')).toBeTruthy();
  });
});
