import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Decoration, Finding } from '@fluid/shared';
import { DecorationBadge, severityLabel } from './DecorationBadge';

beforeAll(() => {
  // antd's tooltip observes its size; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const finding = (severity: Finding['severity'], message = 'm'): Finding => ({
  decoratorId: 'd',
  ruleId: 'r',
  severity,
  message,
});
const deco = (tags: string[], findings: Finding[]): Decoration => ({
  target: { type: 'node', key: 'a' },
  tags,
  findings,
});

describe('DecorationBadge', () => {
  it('renders nothing for undefined or empty input', () => {
    const { container, rerender } = render(<DecorationBadge />);
    expect(container.innerHTML).toBe('');
    rerender(<DecorationBadge decoration={deco([], [])} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the tags', () => {
    render(<DecorationBadge decoration={deco(['domain', 'api'], [])} />);
    expect(screen.getByText('domain')).toBeTruthy();
    expect(screen.getByText('api')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('colors the dot by the worst severity and labels it', () => {
    render(<DecorationBadge decoration={deco([], [finding('warning'), finding('error'), finding('error')])} />);
    const dot = screen.getByRole('img');
    expect(dot.getAttribute('aria-label')).toBe('2 errors, 1 warning');
    expect(dot.style.background).toContain('--ant-color-error');
  });

  it('lists the findings in the tooltip, at most 10', async () => {
    const findings = Array.from({ length: 12 }, (_, i) => finding('info', `msg ${i}`));
    render(<DecorationBadge decoration={deco([], findings)} />);
    fireEvent.mouseEnter(screen.getByRole('img'));
    await waitFor(() => expect(screen.getByText('msg 0')).toBeTruthy());
    expect(screen.getByText('msg 9')).toBeTruthy();
    expect(screen.queryByText('msg 10')).toBeNull();
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('formats the severity label', () => {
    expect(severityLabel({ error: 1, warning: 0, info: 3 })).toBe('1 error, 3 infos');
  });
});
