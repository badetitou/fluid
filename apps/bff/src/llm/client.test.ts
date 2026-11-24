import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion } from './client';
import type { ChatMessage, LlmConfig } from './types';

const config = (baseUrl: string): LlmConfig => ({ provider: 'openai', model: 'test', baseUrl });
const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('chatCompletion', () => {
  it('does not send response_format to endpoints known to lack JSON mode', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(ok('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await chatCompletion(config('https://generativelanguage.googleapis.com/v1beta/openai'), messages);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('response_format');
  });

  it('retries once without JSON mode when the endpoint rejects the flag', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('response_format not supported', { status: 400 }))
      .mockResolvedValueOnce(ok('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const content = await chatCompletion(config('https://api.openai.com/v1'), messages);

    expect(content).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('response_format');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).not.toContain('response_format');
  });

  it('does not retry an unrelated bad request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('unknown model', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(chatCompletion(config('https://api.openai.com/v1'), messages)).rejects.toThrow('HTTP 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
