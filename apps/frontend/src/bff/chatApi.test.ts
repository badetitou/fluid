import { afterEach, describe, expect, it, vi } from 'vitest';
import { postChat } from './chatApi';

const payload = { concept: 'Character', schema: { name: 'Character', fields: [] }, prompt: 'hi', scope: 'graph' as const };

function answerWith(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

describe('postChat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a valid answer', async () => {
    answerWith({ message: 'hello', provider: 'mock', model: 'm' });
    await expect(postChat(payload)).resolves.toMatchObject({ message: 'hello' });
  });

  it('rejects an answer that does not match the contract', async () => {
    answerWith({ reply: 'hello' });
    await expect(postChat(payload)).rejects.toThrow();
  });
});
