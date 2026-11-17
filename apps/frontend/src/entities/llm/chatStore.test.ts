import { beforeEach, describe, expect, it } from 'vitest';
import { beginTurn, settleTurn } from './chatModel';
import { useChatStore } from './chatStore';

describe('chat store', () => {
  beforeEach(() => useChatStore.setState({ byConcept: {} }));

  it('keeps each concept\'s conversation, turn in flight and error apart', () => {
    const { change } = useChatStore.getState();
    change('Character', (e) => beginTurn(e, 'hi'));
    change('Episode', (e) => settleTurn(beginTurn(e, 'yo'), 0, { error: 'boom' }));
    const { byConcept } = useChatStore.getState();
    expect(byConcept.Character).toMatchObject({ pending: true, error: null });
    expect(byConcept.Character.conversation.turns).toHaveLength(1);
    expect(byConcept.Episode).toMatchObject({ pending: false, error: 'boom' });
    expect(byConcept.Location).toBeUndefined();
  });
});
