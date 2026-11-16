import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLlmSettings } from '../../store';
import { useLlmSettingsDraft } from './useLlmSettingsDraft';

function resetStore() {
  useLlmSettings.setState({ provider: 'mock', providerChosen: false, model: '', apiKey: '', baseUrl: '' });
}

describe('useLlmSettingsDraft', () => {
  beforeEach(resetStore);

  it('shows the server default while no provider was chosen', () => {
    const { result } = renderHook(() => useLlmSettingsDraft('claude-code'));
    expect(result.current.draft.provider).toBe('claude-code');
  });

  it('does not pin the provider when only other fields are edited', () => {
    const { result } = renderHook(() => useLlmSettingsDraft('claude-code'));
    act(() => result.current.update({ model: 'x' }));
    act(() => result.current.save());
    expect(useLlmSettings.getState()).toMatchObject({ providerChosen: false, model: 'x' });
  });

  it('pins the provider the user picks', () => {
    const { result } = renderHook(() => useLlmSettingsDraft('claude-code'));
    act(() => result.current.update({ model: 'old' }));
    act(() => result.current.setProvider('ollama'));
    act(() => result.current.save());
    expect(useLlmSettings.getState()).toMatchObject({ provider: 'ollama', providerChosen: true, model: '' });
  });
});

describe('useLlmSettings persisted migration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('keeps a provider saved before the flag existed as chosen', async () => {
    localStorage.setItem(
      'fluid-llm-settings',
      JSON.stringify({ state: { provider: 'ollama', model: 'm', apiKey: '', baseUrl: '' }, version: 0 }),
    );
    await useLlmSettings.persist.rehydrate();
    expect(useLlmSettings.getState()).toMatchObject({ provider: 'ollama', model: 'm', providerChosen: true });
  });

  it('leaves a fresh browser unchosen', async () => {
    await useLlmSettings.persist.rehydrate();
    expect(useLlmSettings.getState().providerChosen).toBe(false);
  });
});
