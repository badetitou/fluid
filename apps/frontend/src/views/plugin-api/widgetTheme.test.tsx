import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BADETITOU_THEME } from '../../shared/theme';
import { WidgetThemeContext, useWidgetTheme } from './widgetTheme';

const base = BADETITOU_THEME.light!;
const themed =
  (tokens: typeof base) =>
  ({ children }: { children: ReactNode }) => (
    <WidgetThemeContext.Provider value={{ mode: 'light', tokens }}>{children}</WidgetThemeContext.Provider>
  );

describe('useWidgetTheme status', () => {
  it('takes the theme status tokens, including info', () => {
    const tokens = { ...base, status: { success: '#111111', warning: '#222222', error: '#333333', info: '#444444' } };
    const { result } = renderHook(() => useWidgetTheme('x'), { wrapper: themed(tokens) });
    expect(result.current.status).toEqual({ success: '#111111', warning: '#222222', error: '#333333', info: '#444444' });
  });

  it('falls back to the antd variables', () => {
    const tokens = { ...base, status: undefined };
    const { result } = renderHook(() => useWidgetTheme('x'), { wrapper: themed(tokens) });
    expect(result.current.status).toEqual({
      success: 'var(--ant-color-success)',
      warning: 'var(--ant-color-warning)',
      error: 'var(--ant-color-error)',
      info: 'var(--ant-color-info)',
    });
  });
});
