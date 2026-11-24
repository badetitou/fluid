import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createEngine = vi.hoisted(() => vi.fn());

vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: createEngine,
  WebWorkerMLCEngineHandler: class {},
}));

const chunk = (content: string) => ({ choices: [{ delta: { content } }] });

describe('browserEngine', () => {
  beforeEach(() => {
    vi.resetModules();
    createEngine.mockReset();
    createEngine.mockImplementation(async (_worker: unknown, _model: string, config: {
      initProgressCallback: (report: { progress: number; text: string }) => void;
    }) => {
      config.initProgressCallback({ progress: 0.5, text: 'Fetching weights' });
      return {
        chat: {
          completions: {
            create: async () =>
              (async function* () {
                yield chunk('hello');
                yield chunk(' world');
              })(),
          },
        },
      };
    });
    vi.stubGlobal('Worker', class {
      terminate() {
        /* no-op in tests */
      }
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'gpu', {
      value: { requestAdapter: async () => null },
      configurable: true,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('detects WebGPU and refuses insecure origins', async () => {
    const { browserSupport } = await import('./browserEngine');
    expect(browserSupport().supported).toBe(true);
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    expect(browserSupport().supported).toBe(false);
  });

  it('streams a completion and reuses the engine for the same model', async () => {
    const { browserComplete, getBrowserLlmStatus } = await import('./browserEngine');
    const deltas: string[] = [];
    const text = await browserComplete('test-model', [{ role: 'user', content: 'hi' }], (d) => deltas.push(d.text));
    expect(text).toBe('hello world');
    expect(deltas).toEqual(['hello', ' world']);
    await browserComplete('test-model', [{ role: 'user', content: 'again' }]);
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(getBrowserLlmStatus().state).toBe('ready');
  });
});
