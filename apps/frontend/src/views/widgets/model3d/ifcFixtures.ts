// Small IFC products shaped like the IfcGeometry fragment returns them, for tests.

const axis = (location: number[], z = [0, 0, 1], x = [1, 0, 0]) => ({
  location: { coordinates: location },
  axis: { directionRatios: z },
  refDirection: { directionRatios: x },
});

/** A 4 × 0.2 × 3 wall: a rectangle extruded up, placed at (10, 0, 0) in a storey raised by 1. */
export const wall = {
  __typename: 'IfcWallStandardCase',
  _id: 'inst:wall',
  name: 'Wall A',
  objectPlacement: {
    relativePlacement: axis([10, 0, 0]),
    placementRelTo: { relativePlacement: axis([0, 0, 1]), placementRelTo: null },
  },
  representation: {
    representations: [
      { representationIdentifier: 'Axis', items: [{ __typename: 'IfcPolyline' }] },
      {
        representationIdentifier: 'Body',
        items: [
          {
            __typename: 'IfcExtrudedAreaSolid',
            depth: 3,
            extrudedDirection: { directionRatios: [0, 0, 1] },
            position: axis([2, 0.1, 0]),
            sweptArea: { __typename: 'IfcRectangleProfileDef', xDim: 4, yDim: 0.2, position: null },
          },
        ],
      },
    ],
  },
};

const square = (z: number, size = 1) => [
  [0, 0, z],
  [size, 0, z],
  [size, size, z],
  [0, size, z],
];
const face = (...loops: { outer: boolean; points: number[][] }[]) => ({
  bounds: loops.map((l) => ({
    __typename: l.outer ? 'IfcFaceOuterBound' : 'IfcFaceBound',
    bound: { polygon: l.points.map((coordinates) => ({ coordinates })) },
  })),
});

/** A unit square face with a hole, as a B-rep, mapped twice: once as is, once moved by (0, 0, 5) and scaled by 2. */
export const terminal = {
  __typename: 'IfcFlowTerminal',
  _id: 'inst:terminal',
  name: 'Sink',
  objectPlacement: { relativePlacement: axis([0, 0, 0]) },
  representation: {
    representations: [
      { representationIdentifier: 'Box', items: [{ __typename: 'IfcBoundingBox', corner: { coordinates: [0, 0, 0] }, xDim: 1, yDim: 1, zDim: 1 }] },
      {
        representationIdentifier: 'Body',
        items: [null, { localOrigin: { coordinates: [0, 0, 5] }, scale: 2 }].map((target) => ({
          __typename: 'IfcMappedItem',
          mappingTarget: target,
          mappingSource: {
            mappingOrigin: axis([0, 0, 0]),
            mappedRepresentation: {
              items: [
                {
                  __typename: 'IfcFacetedBrep',
                  outer: { cfsFaces: [face({ outer: true, points: square(0, 3) }, { outer: false, points: square(0).map(([x, y, z]) => [x + 1, y + 1, z]) })] },
                },
              ],
            },
          },
        })),
      },
    ],
  },
};

/** An element without geometry (a port). */
export const port = { __typename: 'IfcDistributionPort', _id: 'inst:port', name: 'Port', objectPlacement: null, representation: null };

/** An opening, cut out of the wall: hidden from whole models by default. */
export const opening = { ...wall, __typename: 'IfcOpeningElement', _id: 'inst:opening', name: 'Opening' };
