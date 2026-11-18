import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const oauth = vi.hoisted(() => ({
  settings: undefined as undefined | { issuer: string; clientId: string; scopes: string[] },
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../entities/source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../entities/source')>();
  return {
    ...actual,
    useBrowserOAuth: () => ({ ...oauth, token: undefined, usable: false, signOut: vi.fn() }),
    useBrowserSignIn: () => ({ status: 'idle', error: null, start: vi.fn() }),
  };
});

import { BrowserOAuthSettings } from './BrowserOAuthSettings';

describe('BrowserOAuthSettings', () => {
  it('is hidden when a BFF is there and nothing is kept', () => {
    oauth.settings = undefined;
    const { container } = render(<BrowserOAuthSettings url="https://api.test/graphql" offered={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('says it is for demos, shows the redirect URI, and saves the typed settings', () => {
    oauth.settings = undefined;
    render(<BrowserOAuthSettings url="https://api.test/graphql" offered />);
    expect(screen.getByText('For demos only')).toBeTruthy();
    expect(screen.getByText(/oauth-callback\.html$/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Browser issuer'), { target: { value: 'https://as.test' } });
    fireEvent.change(screen.getByLabelText('Browser client id'), { target: { value: 'fluid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(oauth.save).toHaveBeenCalledWith({ issuer: 'https://as.test', clientId: 'fluid', scopes: [] });
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('offers sign-in once settings are kept, even with a BFF', () => {
    oauth.settings = { issuer: 'https://as.test', clientId: 'fluid', scopes: [] };
    render(<BrowserOAuthSettings url="https://api.test/graphql" offered={false} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Not signed in')).toBeTruthy();
  });
});
