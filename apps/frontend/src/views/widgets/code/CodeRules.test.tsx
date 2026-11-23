import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { decoratorSpecSchema, type CodeWidget as CodeWidgetSpec } from '@fluid/shared';
import { DecorationsProvider } from '../../plugin-api/decorations';
import { CodeWidget } from './CodeWidget';

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

describe('CodeWidget rules', () => {
  it('annotates the line a graph decorator flags', () => {
    const { container } = render(
      <DecorationsProvider decorators={[decorator]}>
        <CodeWidget widget={widget} data={file} resolve={() => ast} />
      </DecorationsProvider>,
    );
    expect(screen.getByText('Prefer notifyAll()')).toBeTruthy();
    expect(container.querySelectorAll('[data-severity]')).toHaveLength(1);
    expect(screen.getByText('java-notify-all')).toBeTruthy();
  });

  it('shows nothing without decorators', () => {
    render(<CodeWidget widget={widget} data={file} resolve={() => ast} />);
    expect(screen.queryByText('Prefer notifyAll()')).toBeNull();
  });
});
