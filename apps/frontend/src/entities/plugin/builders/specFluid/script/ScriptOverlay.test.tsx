import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SpecFluidEvaluation } from '@fluid/shared';
import { MillerColumnPathContext, OpenableConceptsContext } from '../../../../../navigation/columnPath';
import type { ColumnOverlayProps } from '../../../viewBuilder';
import { evaluate } from '../api';
import { ScriptOverlay } from './ScriptOverlay';

vi.mock('../api', () => ({ evaluate: vi.fn() }));
const evaluateMock = vi.mocked(evaluate);
const ENDPOINT = 'http://localhost:8081/spec-fluid';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderOverlay(props: Partial<ColumnOverlayProps> = {}) {
  const overlay = (
    <ScriptOverlay concept="Class" columnKind="detail" itemId="1:1" settings={{ endpoint: ENDPOINT }} {...props} />
  );
  render(
    <MemoryRouter initialEntries={['/d/Class/Class@1:1']}>
      <MillerColumnPathContext.Provider value="/d/Class/Class@1:1">
        <OpenableConceptsContext.Provider value={new Set(['Class', 'Method'])}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {overlay}
                  <Location />
                </>
              }
            />
          </Routes>
        </OpenableConceptsContext.Provider>
      </MillerColumnPathContext.Provider>
    </MemoryRouter>,
  );
}

async function typeAndRun(code: string, result: SpecFluidEvaluation | Error) {
  if (result instanceof Error) evaluateMock.mockRejectedValueOnce(result);
  else evaluateMock.mockResolvedValueOnce(result);
  fireEvent.click(screen.getByRole('button', { name: 'Pharo' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Pharo script' }));
  const editor = screen.getByLabelText('Smalltalk code');
  expect((editor as HTMLTextAreaElement).value).toBe('self ');
  fireEvent.change(editor, { target: { value: code } });
  fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  evaluateMock.mockReset();
});

describe('Pharo script overlay', () => {
  it('shows only on a detail column, once the endpoint is set', () => {
    renderOverlay({ columnKind: 'list', itemId: undefined });
    renderOverlay({ settings: { endpoint: '' } });
    expect(screen.queryByRole('button', { name: 'Pharo' })).toBeNull();
  });

  it('opens the entity a script answers in the next column', async () => {
    renderOverlay();
    await typeAndRun('self methods anyOne', { display: 'bar', ref: { id: '1:2', type: 'Method' } });
    expect(evaluateMock).toHaveBeenCalledWith(ENDPOINT, '1:1', 'self methods anyOne', expect.any(AbortSignal));
    expect(await screen.findByText(/Opened bar in the next column/)).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toContain('Method');
  });

  it('shows what a script prints and the entities it holds', async () => {
    renderOverlay();
    await typeAndRun('self methods', {
      display: 'a MooseGroup',
      items: [{ text: 'bar', ref: { id: '1:2', type: 'Method' } }, { text: 'plain' }],
    });
    expect(await screen.findByText('a MooseGroup')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByRole('link', { name: /bar/ })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/d/Class/Class@1:1');
  });

  it('shows the error of a script that fails', async () => {
    renderOverlay();
    await typeAndRun('self zork', new Error('Spec-Fluid: Message not understood: FamixStClass >> #zork'));
    expect(await screen.findByText(/Message not understood/)).toBeTruthy();
  });
});
