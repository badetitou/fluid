import { overviewPyramidExample, type PyramidWidget } from '@fluid/shared';
import { resolveBinding } from '../../data';

/** The pyramid of the curated example. */
export const pyramidSpec = overviewPyramidExample.widgets[0] as PyramidWidget;

const method = (id: string, linesOfCode: number, cyclomaticComplexity: number, calls: number) => ({
  id,
  linesOfCode,
  cyclomaticComplexity,
  outgoingInvocations: Array.from({ length: calls }, (_, i) => ({ id: `${id}-call${i}` })),
});

/**
 * A package as the example's query returns it: 2 sub-packages, 3 classes
 * (A with subclasses B and C), 3 methods of 24 lines, cyclo 6, 6 calls.
 */
export const pyramidResult = {
  package: {
    id: 'p1',
    name: 'Kernel',
    childPackages: [{ id: 'p2' }, { id: 'p3' }],
    classes: [
      { id: 'A', fanOut: 2, hierarchyNestingLevel: 1, subclasses: [{ id: 'B' }, { id: 'C' }], methods: [method('m1', 10, 2, 2), method('m2', 6, 1, 1)] },
      { id: 'B', fanOut: 1, hierarchyNestingLevel: 2, subclasses: [], methods: [method('m3', 8, 3, 3)] },
      { id: 'C', fanOut: 0, hierarchyNestingLevel: 2, subclasses: [], methods: [] },
    ],
  },
};

/** The bound object of the example's pyramid. */
export const pyramidData = resolveBinding(pyramidSpec.data, { package: pyramidResult });
