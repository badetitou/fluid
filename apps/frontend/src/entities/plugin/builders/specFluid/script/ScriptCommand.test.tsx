import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SpecFluidEvaluation } from '@fluid/shared';
import { OpenableConceptsContext } from '../../../../../navigation/columnPath';
import type { PageActionContext } from '../../../pageAction';
import { evaluate } from '../api';
import { pharoScriptAction } from './ScriptCommand';

vi.mock('../api', () => ({ evaluate: vi.fn() }));
const evaluateMock = vi.mocked(evaluate);
const ENDPOINT = 'http://localhost:8081/spec-fluid';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const CONTEXT: PageActionContext = {
  settings: { endpoint: ENDPOINT },
  palette: ['#000'],
  mode: 'light',
  focus: { concept: 'Class', itemId: '1:1', path: '/d/Class/Class@1:1' },
};

function renderPanel() {
  const Panel = pharoScriptAction.Panel!;
  const overlay = <Panel context={CONTEXT} onClose={() => {}} />;
  render(
    <MemoryRouter initialEntries={['/d/Class/Class@1:1']}>
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
    </MemoryRouter>,
  );
}

async function typeAndRun(code: string, result: SpecFluidEvaluation | Error) {
  if (result instanceof Error) evaluateMock.mockRejectedValueOnce(result);
  else evaluateMock.mockResolvedValueOnce(result);
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

describe('Pharo script command', () => {
  it('is offered on a detail column, once the endpoint is set', () => {
    const offered = pharoScriptAction.available!;
    expect(offered(CONTEXT)).toBe(true);
    expect(offered({ ...CONTEXT, focus: { concept: 'Class', path: '/d/Class' } })).toBe(false);
    expect(offered({ ...CONTEXT, focus: undefined })).toBe(false);
    expect(offered({ ...CONTEXT, settings: { endpoint: '' } })).toBe(false);
  });

  it('opens the entity a script answers in the next column', async () => {
    renderPanel();
    await typeAndRun('self methods anyOne', { display: 'bar', ref: { id: '1:2', type: 'Method' } });
    expect(evaluateMock).toHaveBeenCalledWith(
      ENDPOINT,
      '1:1',
      'self methods anyOne',
      expect.any(AbortSignal),
    );
    expect(await screen.findByText(/Opened bar in the next column/)).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toContain('Method');
  });

  it('shows what a script prints and the entities it holds', async () => {
    renderPanel();
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
    renderPanel();
    await typeAndRun(
      'self zork',
      new Error('Spec-Fluid: Message not understood: FamixStClass >> #zork'),
    );
    expect(await screen.findByText(/Message not understood/)).toBeTruthy();
  });
});
