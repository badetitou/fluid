import { describe, expect, it, vi } from 'vitest';
import { useLlmSettings } from '../../store';
import { currentConfig } from './currentConfig';

vi.mock('../../bff/client', () => ({ bffClient: { getLlmConfig: vi.fn() } }));

describe('currentConfig', () => {
  it('never builds a BFF payload for the browser provider', async () => {
    useLlmSettings.setState({ provider: 'browser', providerChosen: true, model: 'local-model' });
    await expect(currentConfig()).rejects.toThrow('runs locally');
    useLlmSettings.setState({ provider: 'mock', providerChosen: false, model: '' });
  });

  it('forwards the other providers as before', async () => {
    useLlmSettings.setState({ provider: 'openai', providerChosen: true, model: 'gpt-4o-mini', apiKey: 'k' });
    await expect(currentConfig()).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'k',
    });
    useLlmSettings.setState({ provider: 'mock', providerChosen: false, model: '', apiKey: '' });
  });
});
