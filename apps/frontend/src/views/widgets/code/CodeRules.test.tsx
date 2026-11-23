import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { decoratorSpecSchema, type CodeWidget as CodeWidgetSpec } from '@fluid/shared';
import * as decorations from '../../plugin-api/decorations';
import { CodeWidget } from './CodeWidget';

vi.mock('../../plugin-api/decorations', async (importActual) => {
  const actual = await importActual<typeof import('../../plugin-api/decorations')>();
  const calls: unknown[] = [];
  const useDecorations = (graph: Parameters<typeof actual.useDecorations>[0]) => {
    calls.push(graph);
    return actual.useDecorations(graph);
  };
  return { ...actual, useDecorations, graphCalls: calls };
});

const decorator = decoratorSpecSchema.parse({
  id: 'syntax',
  label: 'Syntax',
  constraints: [
    {
      id: 'java-notify-all',
      check: 'node',
      severity: 'warning',
      message: 'Prefer notifyAll()',
      match: {
        kind: 'MethodInvocation',
        name: '^notify$',
        has: { via: ['child'], match: { kind: 'Argument' }, min: 0, max: 0 },
      },
    },
  ],
});

const widget: CodeWidgetSpec = {
  type: 'code',
  id: 'src',
  data: { query: 'file' },
  field: 'source',
  rules: { data: { query: 'ast' }, parentField: 'parent', lineField: 'line' },
};
const ast = [
  { id: 'root', kind: 'Method', line: 1 },
  { id: 'call', kind: 'MethodInvocation', name: 'notify', parent: 'root', line: 2 },
  { id: 'ok', kind: 'MethodInvocation', name: 'notify', parent: 'root', line: 3 },
  { id: 'arg', kind: 'Argument', parent: 'ok', line: 3 },
];
const file = { source: 'void run() {\n  lock.notify();\n  lock.notify(x);\n}' };

const { DecorationsProvider } = decorations;
const graphCalls = (decorations as unknown as { graphCalls: unknown[] }).graphCalls;

const renderWith = (spec: CodeWidgetSpec, resolve: () => unknown, decorators = [decorator]) =>
  render(
    <DecorationsProvider decorators={decorators}>
      <CodeWidget widget={spec} data={file} resolve={resolve} />
    </DecorationsProvider>,
  );

describe('CodeWidget rules', () => {
  beforeEach(() => {
    graphCalls.length = 0;
  });

  it('annotates the line a graph decorator flags, and only that one', () => {
    const { container } = renderWith(widget, () => ast);
    const flagged = container.querySelectorAll('[data-severity]');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].textContent).toContain('lock.notify();');
    expect(flagged[0].textContent).not.toContain('notify(x)');
    expect(screen.getByText('Prefer notifyAll()')).toBeTruthy();
    expect(screen.getByText('java-notify-all')).toBeTruthy();
  });

  it('shows nothing without decorators', () => {
    renderWith(widget, () => ast, []);
    expect(screen.queryByText('Prefer notifyAll()')).toBeNull();
  });

  it('gives useDecorations no graph without rules', () => {
    renderWith({ ...widget, rules: undefined }, () => ast);
    expect(graphCalls.length).toBeGreaterThan(0);
    expect(graphCalls.every((graph) => graph === undefined)).toBe(true);
    expect(screen.queryByText('Prefer notifyAll()')).toBeNull();
  });

  it('merges rule findings with the annotations binding', () => {
    const both: CodeWidgetSpec = {
      ...widget,
      annotations: { field: 'critiques', lineField: 'line', messageField: 'message' },
    };
    const withCritiques = { source: file.source, critiques: [{ line: 4, message: 'Closing brace' }] };
    render(
      <DecorationsProvider decorators={[decorator]}>
        <CodeWidget widget={both} data={withCritiques} resolve={() => ast} />
      </DecorationsProvider>,
    );
    expect(screen.getByText('Closing brace')).toBeTruthy();
    expect(screen.getByText('Prefer notifyAll()')).toBeTruthy();
  });
});
