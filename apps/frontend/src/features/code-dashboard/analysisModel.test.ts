import { describe, expect, it } from 'vitest';
import { analysisSchema } from './analysisSchema';
import { toArchitecture } from './analysisModel';

const entity = (name: string) => ({ key: `k:${name}`, name, fineKind: 'method', file: 'A.java' });

const answer = {
  analysis: {
    cycles: {
      count: 2,
      cyclicEntities: 5,
      components: [
        { size: 2, entities: [{ name: 'a' }, { name: 'b' }] },
        { size: 3, entities: [{ name: 'x' }, { name: 'y' }, { name: 'z' }] },
      ],
    },
    isolatedClasses: { totalCount: 15, nodes: [{ ...entity('Dead'), fineKind: 'class' }] },
    isolatedMethods: { totalCount: 25, nodes: [entity('forgotten')] },
    mostConnected: [{ ...entity('hub'), inDegree: 9, outDegree: 3 }],
  },
};

describe('toArchitecture', () => {
  const parsed = analysisSchema.parse(answer);
  const arch = toArchitecture(parsed.analysis);

  it('lists the biggest cycles first', () => {
    expect(arch.cycleCount).toBe(2);
    expect(arch.cyclicEntities).toBe(5);
    expect(arch.cycles.map((c) => c.size)).toEqual([3, 2]);
    expect(arch.cycles[0].members).toEqual(['x', 'y', 'z']);
  });
  it('adds the totals of isolated classes and methods, not only the pages read', () => {
    expect(arch.isolatedCount).toBe(40);
    expect(arch.isolated.map((e) => e.name)).toEqual(['Dead', 'forgotten']);
  });
  it('carries the degrees of the most connected entities', () => {
    expect(arch.hubs[0]).toMatchObject({ name: 'hub', inDegree: 9, outDegree: 3 });
  });
});

describe('analysisSchema', () => {
  it('rejects what an older server answers', () => {
    expect(analysisSchema.safeParse({ analysis: null }).success).toBe(false);
    expect(analysisSchema.safeParse(undefined).success).toBe(false);
  });
});
