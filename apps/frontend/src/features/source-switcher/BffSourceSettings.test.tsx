import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ bff: {} as Record<string, unknown> }));
vi.mock('../../entities/source', () => ({
  useSources: () => ({ current: 'https://api.example.com/graphql', currentName: 'Example' }),
  useBffSourceConfig: () => state.bff,
  authFormOf: () => ({ authKind: 'none', headerName: 'Authorization', secret: '' }),
}));

import { BffSourceSettings } from './BffSourceSettings';

const bff = (over: Record<string, unknown>) => {
  state.bff = {
    available: true,
    routed: false,
    config: null,
    busy: false,
    error: null,
    enable: vi.fn(),
    disable: vi.fn(),
    save: vi.fn(),
    removeSecret: vi.fn(),
    ...over,
  };
};

describe('BffSourceSettings', () => {
  it('disables the switch with an explanation when no BFF is reachable', () => {
    bff({ available: false });
    render(<BffSourceSettings />);
    expect((screen.getByRole('switch', { name: 'Via the BFF' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No BFF is reachable/)).toBeTruthy();
  });

  it('keeps the switch usable for a routed source whose BFF is down', () => {
    bff({ available: false, routed: true });
    render(<BffSourceSettings />);
    expect((screen.getByRole('switch', { name: 'Via the BFF' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/The BFF is unreachable/)).toBeTruthy();
  });
});
