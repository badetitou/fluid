import { describe, expect, it } from 'vitest';
import type { ChatTurn } from '../../../llm/chatModel';
import { seedFor } from './useBuildView';

const answered: ChatTurn[] = [
  { id: 1, role: 'user', text: 'hi' },
  { id: 2, role: 'assistant', text: 'hello' },
];

describe('seedFor', () => {
  it('builds a dashboard by default on the whole graph, a perspective elsewhere', () => {
    expect(seedFor(answered, '@graph').asDashboard).toBe(true);
    expect(seedFor(answered, 'Character').asDashboard).toBe(false);
    expect(seedFor(answered, 'Character', { asDashboard: true }).asDashboard).toBe(true);
  });
});
