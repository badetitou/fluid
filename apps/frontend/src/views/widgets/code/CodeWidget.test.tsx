import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { methodSourceExample, type CodeWidget as CodeWidgetSpec } from '@fluid/shared';
import { CodeWidget } from './CodeWidget';

const [sourceSpec, changesSpec] = methodSourceExample.widgets as CodeWidgetSpec[];
const resolve = () => undefined;
const method = {
  sourceCode: 'printOn: aStream\n\t"Print the name"\n\taStream nextPutAll: self name',
  critiques: [
    { line: 3, message: 'Sends self name twice', severity: 'warning', rule: 'Duplicated send' },
    { line: 1, message: 'Missing category', severity: 'high', rule: 'Uncategorized' },
  ],
  previousVersion: { sourceCode: 'printOn: aStream\n\taStream nextPutAll: name' },
};

describe('CodeWidget', () => {
  it('shows numbered, highlighted lines with the critiques under them', () => {
    const { container } = render(<CodeWidget widget={sourceSpec} data={method} resolve={resolve} />);
    expect(container.querySelectorAll('[data-severity]')).toHaveLength(2);
    expect(screen.getByText('Missing category')).toBeTruthy();
    expect(screen.getByText('1 error')).toBeTruthy();
    expect(screen.getByText('1 warning')).toBeTruthy();
    expect(container.querySelector('.token')).toBeTruthy();
  });

  it('steps through search hits', () => {
    const { container } = render(<CodeWidget widget={sourceSpec} data={method} resolve={resolve} />);
    fireEvent.change(screen.getByLabelText('Search the code'), { target: { value: 'astream' } });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next match'));
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(container.querySelectorAll('[data-current]')).toHaveLength(1);
  });

  it('shows the diff against the previous version', () => {
    render(<CodeWidget widget={changesSpec} data={method} resolve={resolve} />);
    expect(screen.getByText(/vs previous version/)).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('−1')).toBeTruthy();
  });

  it('shows an empty state without code', () => {
    render(<CodeWidget widget={sourceSpec} data={{}} resolve={resolve} />);
    expect(screen.getByText('No code')).toBeTruthy();
  });
});
