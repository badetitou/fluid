import { describe, expect, it } from 'vitest';
import { butterflyExample, type ButterflyWidget } from '@fluid/shared';
import { buildButterfly, CENTER_ID, emptyReason, MAX_PER_SIDE, neighboursOf, tooltipOf } from './butterflyModel';
import { centerMethod, nextPutAll } from './butterflyFixture';

const spec = butterflyExample.widgets[0] as ButterflyWidget;

describe('butterflyModel', () => {
  it('puts the callers on the left and the callees on the right, duplicates counted', () => {
    const b = buildButterfly(centerMethod, spec)!;
    expect(b.center).toMatchObject({ key: '2:0', label: 'printStringLimitedTo:', group: 'Object' });
    const left = b.nodes.filter((n) => n.side === 'in').map((n) => [n.label, n.weight]);
    expect(left).toEqual([
      ['printString', 2],
      ['displayString', 1],
    ]);
    expect(b.nodes.filter((n) => n.side === 'out').map((n) => n.label)).toEqual(['printOn:', 'writeStream', 'nextPutAll:']);
    expect(b.sides.in.count).toBe(2);
    expect(b.sides.out.count).toBe(3);
    // arrows flow to the right: caller → center → callee
    expect(b.edges).toContainEqual({ key: `in1:2:1→${CENTER_ID}`, source: 'in1:2:1', target: CENTER_ID, weight: 2 });
    expect(b.edges).toContainEqual({ key: `${CENTER_ID}→out1:2:4`, source: CENTER_ID, target: 'out1:2:4', weight: 2 });
    expect(b.groups).toEqual(['Object', 'Collection', 'String', 'WriteStream']);
  });

  it('reads ids, objects or bare names, and completes a bare id with the object describing it', () => {
    const row = { calls: ['x', { id: 'x', name: 'Ex' }, { name: 'no id' }, null] };
    const out = neighboursOf(row, 'calls', {});
    expect([...out.values()].map((n) => [n.key, n.label, n.weight])).toEqual([
      ['x', 'Ex', 2],
      ['label:no id', 'no id', 1],
    ]);
  });

  it('skips the element itself (recursion)', () => {
    const b = buildButterfly({ id: 'r', name: 'fact', calls: [{ id: 'r' }, { id: 's', name: 's' }] }, { outgoingField: 'calls' })!;
    expect(b.nodes.map((n) => n.key)).toEqual(['s']);
  });

  it('follows the neighbours of the neighbours at depth 2, when the query selected them', () => {
    const row = {
      id: 'c',
      name: 'center',
      callers: [
        { id: 'a', name: 'a', callers: [{ id: 'x', name: 'x' }, { id: 'c' }, { id: 'b' }] },
        { id: 'b', name: 'b', callers: [{ id: 'x' }, { id: 'y', name: 'y' }] },
        { id: 'd', name: 'd' },
      ],
    };
    const b = buildButterfly(row, { incomingField: 'callers', depth: 2 })!;
    const outer = b.nodes.filter((n) => n.level === 2);
    expect(outer.map((n) => [n.label, n.weight])).toEqual([
      ['x', 2],
      ['y', 1],
    ]);
    expect(b.edges.filter((e) => e.source === 'in2:x').map((e) => e.target)).toEqual(['in1:a', 'in1:b']);
    expect(buildButterfly(row, { incomingField: 'callers' })!.nodes.every((n) => n.level === 1)).toBe(true);
  });

  it('groups a crowded side by container, or keeps the heaviest neighbours', () => {
    const many = Array.from({ length: MAX_PER_SIDE + 5 }, (_, i) => ({ id: `m${i}`, name: `m${i}`, pkg: i % 2 ? 'odd' : 'even' }));
    const row = { id: 'c', name: 'c', calls: [...many, many[3]] };
    const grouped = buildButterfly(row, { outgoingField: 'calls', groupField: 'pkg' })!;
    expect(grouped.sides.out).toEqual({ count: MAX_PER_SIDE + 5, grouped: true, hidden: 0 });
    expect(grouped.nodes.map((n) => [n.label, n.members, n.row])).toEqual([
      ['even (33)', 33, undefined],
      ['odd (32)', 32, undefined],
    ]);
    expect(tooltipOf(grouped.nodes[1])).toBe('odd (32): 32 elements, 33 links');
    const capped = buildButterfly(row, { outgoingField: 'calls' })!;
    expect(capped.nodes).toHaveLength(MAX_PER_SIDE);
    expect(capped.sides.out.hidden).toBe(5);
    expect(capped.nodes.some((n) => n.key === 'm3')).toBe(true);
  });

  it('explains why nothing is drawn', () => {
    expect(emptyReason(buildButterfly(null, spec), spec)).toBe('No element: the query returned nothing to show.');
    const lonely = buildButterfly({ id: '1', name: 'alone' }, spec);
    expect(emptyReason(lonely, spec)).toBe(
      'No dependencies: alone has nothing in "incomingInvocations.sender" or "outgoingInvocations.candidates".',
    );
    expect(emptyReason(buildButterfly(centerMethod, spec), spec)).toBeNull();
  });

  it('describes a neighbour on hover', () => {
    const b = buildButterfly(centerMethod, spec)!;
    expect(tooltipOf(b.nodes.find((n) => n.key === nextPutAll.id)!)).toBe('nextPutAll: (WriteStream) ×2');
  });
});
