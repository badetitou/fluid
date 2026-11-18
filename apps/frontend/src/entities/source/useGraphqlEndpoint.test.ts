import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../runtime-config', () => ({ BFF_URL: 'http://bff.test' }));

import { useConnection } from '../../store';
import { useSavedSources } from './store';
import { useGraphqlEndpoint } from './useGraphqlEndpoint';

const URL_ = 'https://api.example.com/graphql';

beforeEach(() => {
  useConnection.setState({ graphqlUrl: URL_ });
  useSavedSources.setState({ saved: [] });
});

describe('useGraphqlEndpoint', () => {
  it('is the source itself when not routed, and null when not connected', () => {
    expect(renderHook(() => useGraphqlEndpoint()).result.current).toBe(URL_);
    useConnection.setState({ graphqlUrl: null });
    expect(renderHook(() => useGraphqlEndpoint()).result.current).toBeNull();
  });

  it('is the BFF proxy when the source is routed through it', () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'abc' }] });
    expect(renderHook(() => useGraphqlEndpoint()).result.current).toBe('http://bff.test/api/sources/abc/graphql');
  });
});
