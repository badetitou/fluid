import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const signIn = vi.hoisted(() => ({ start: vi.fn(), status: 'idle' }));
vi.mock('../../entities/source', () => ({
  useOAuthSignIn: () => ({ status: signIn.status, start: signIn.start }),
  signInHint: (s: string) => (s === 'blocked' ? 'The browser blocked the sign-in window' : null),
}));

import type { BffSourceConfig } from '../../bff/sourcesApi';
import { OAuthStatus } from './OAuthStatus';

const config = (over: Partial<NonNullable<BffSourceConfig['oauth']>>): BffSourceConfig => ({
  id: 's1',
  name: 'n',
  url: 'https://x',
  authKind: 'oauth',
  headerName: null,
  hasSecret: false,
  oauth: {
    issuer: 'https://as',
    clientId: 'c',
    hasClientSecret: false,
    scopes: [],
    resource: null,
    signedIn: false,
    expiresAt: null,
    grantedScopes: [],
    ...over,
  },
});
const setup = (c: BffSourceConfig) => {
  const onSignOut = vi.fn().mockResolvedValue(true);
  render(<OAuthStatus config={c} busy={false} onSignedIn={vi.fn()} onClosed={vi.fn()} onSignOut={onSignOut} />);
  return { onSignOut };
};

describe('OAuthStatus', () => {
  it('offers Sign in, and no Sign out, when not signed in', () => {
    signIn.status = 'idle';
    setup(config({}));
    expect(screen.getByText('Not signed in')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(signIn.start).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
  });

  it('shows the expiry and the granted scopes when signed in, and signs out', () => {
    signIn.status = 'idle';
    const { onSignOut } = setup(config({ signedIn: true, expiresAt: '2030-01-02T03:04:05.000Z', grantedScopes: ['read', 'write'] }));
    expect(screen.getByText(/Signed in, access token expires/)).toBeTruthy();
    expect(screen.getByText('read')).toBeTruthy();
    expect(screen.getByText('write')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('tells about a blocked popup', () => {
    signIn.status = 'blocked';
    setup(config({}));
    expect(screen.getByText(/blocked the sign-in window/)).toBeTruthy();
  });

  it('shows nothing for a source that does not use OAuth', () => {
    signIn.status = 'idle';
    setup({ ...config({}), authKind: 'none', oauth: null });
    expect(screen.queryByRole('button')).toBeNull();
  });
});
