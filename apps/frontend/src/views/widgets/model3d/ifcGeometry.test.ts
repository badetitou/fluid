import { describe, expect, it } from 'vitest';
import { productTriangles } from './ifcGeometry';
import { apply, axis3Transform, multiply, operatorTransform, placementTransform } from './ifcMath';
import { profileArea } from './ifcPolygons';
import { terminal, wall } from './ifcFixtures';

function boundsOf(positions: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3], v);
    max[i % 3] = Math.max(max[i % 3], v);
  });
  return { min, max };
}

/** Sum of the triangles' areas. */
function area(positions: Float32Array): number {
  let total = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9);
    const [ux, uy, uz, vx, vy, vz] = [bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az];
    total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return total;
}

describe('IFC placements', () => {
  it('turns an axis placement: X follows refDirection, made orthogonal to Z', () => {
    const m = axis3Transform({ location: { coordinates: [1, 2, 3] }, axis: { directionRatios: [0, 0, 1] }, refDirection: { directionRatios: [0, 1, 0.5] } });
    expect(apply(m, 1, 0, 0).map((v) => +v.toFixed(6))).toEqual([1, 3, 3]);
    expect(apply(m, 0, 1, 0).map((v) => +v.toFixed(6))).toEqual([0, 2, 3]);
  });

  it('chains local placements, outermost last', () => {
    const m = placementTransform(wall.objectPlacement);
    expect(apply(m, 0, 0, 0)).toEqual([10, 0, 1]);
  });

  it('composes transforms right to left', () => {
    const move = axis3Transform({ location: { coordinates: [1, 0, 0] } });
    const turn = axis3Transform({ refDirection: { directionRatios: [0, 1, 0] } });
    expect(apply(multiply(move, turn), 1, 0, 0).map((v) => +v.toFixed(6))).toEqual([1, 1, 0]);
  });

  it('scales mapped items, non-uniformly when asked', () => {
    const m = operatorTransform({ localOrigin: { coordinates: [0, 0, 5] }, scale: 2, scale3: 3 });
    expect(apply(m, 1, 1, 1)).toEqual([2, 2, 8]);
  });
});

describe('IFC profiles', () => {
  it('centres rectangles and hollows them', () => {
    const area = profileArea({ __typename: 'IfcRectangleHollowProfileDef', xDim: 4, yDim: 2, wallThickness: 0.5 });
    expect(area?.outer).toEqual([[-2, -1], [2, -1], [2, 1], [-2, 1]]);
    expect(area?.holes[0]).toEqual([[-1.5, -0.5], [1.5, -0.5], [1.5, 0.5], [-1.5, 0.5]]);
  });

  it('drops the closing point of polylines', () => {
    const points = [[0, 0], [1, 0], [1, 1], [0, 0]].map((coordinates) => ({ coordinates }));
    expect(profileArea({ __typename: 'IfcArbitraryClosedProfileDef', outerCurve: { points } })?.outer).toHaveLength(3);
  });

  it('ignores profiles it cannot draw', () => {
    expect(profileArea({ __typename: 'IfcIShapeProfileDef' })).toBeNull();
    expect(profileArea({ __typename: 'IfcCircleProfileDef', radius: null })).toBeNull();
  });
});

describe('productTriangles', () => {
  it('extrudes a wall into a closed box, in world coordinates', () => {
    const positions = productTriangles(wall)!;
    expect(positions.length / 9).toBe(12);
    const { min, max } = boundsOf(positions);
    expect(min.map((v) => +v.toFixed(4))).toEqual([10, 0, 1]);
    expect(max.map((v) => +v.toFixed(4))).toEqual([14, 0.2, 4]);
    expect(area(positions)).toBeCloseTo(2 * (4 * 0.2 + 4 * 3 + 0.2 * 3), 4);
  });

  it('places each use of a mapped B-rep, holes left open', () => {
    const positions = productTriangles(terminal)!;
    const { min, max } = boundsOf(positions);
    expect(min).toEqual([0, 0, 0]);
    expect(max).toEqual([6, 6, 5]);
    // 3×3 square minus a 1×1 hole, then the same scaled by 2.
    expect(area(positions)).toBeCloseTo(8 + 8 * 4, 4);
  });

  it('prefers the requested representation, and falls back on the others', () => {
    expect(boundsOf(productTriangles(terminal, 'Box')!).max).toEqual([1, 1, 1]);
    expect(productTriangles(terminal, 'FootPrint')).not.toBeNull();
  });

  it('returns null without drawable geometry or with malformed data', () => {
    expect(productTriangles({ representation: null })).toBeNull();
    expect(productTriangles({ representation: { representations: [{ items: [{ __typename: 'IfcFacetedBrep', outer: 'oops' }] }] } })).toBeNull();
    expect(productTriangles('wall')).toBeNull();
  });
});
