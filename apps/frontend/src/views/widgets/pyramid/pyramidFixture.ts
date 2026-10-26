import { overviewPyramidExample, type PyramidWidget } from '@fluid/shared';
import { resolveBinding } from '../../data';

/** The pyramid of the curated example. */
export const pyramidSpec = overviewPyramidExample.widgets[0] as PyramidWidget;

const method = (id: string, numberOfLinesOfCode: number, cyclomaticComplexity: number, calls: number) => ({
  id,
  numberOfLinesOfCode,
  cyclomaticComplexity,
  numberOfOutgoingInvocations: calls,
});

/**
 * A package as the example's query returns it (no sub-packages: NOP stays empty), 3 classes
 * (A with subclasses B and C), 3 methods of 24 lines, cyclo 6, 6 calls.
 */
export const pyramidResult = {
  package: {
    id: 'p1',
    name: 'Kernel',
    classes: [
      { id: 'A', fanOut: 2, hierarchyNestingLevel: 1, numberOfDirectSubclasses: 2, methods: [method('m1', 10, 2, 2), method('m2', 6, 1, 1)] },
      { id: 'B', fanOut: 1, hierarchyNestingLevel: 2, numberOfDirectSubclasses: 0, methods: [method('m3', 8, 3, 3)] },
      { id: 'C', fanOut: 0, hierarchyNestingLevel: 2, numberOfDirectSubclasses: 0, methods: [] },
    ],
  },
};

/** The bound object of the example's pyramid. */
export const pyramidData = resolveBinding(pyramidSpec.data, { package: pyramidResult });
