import { ShapeUtils, Vector2 } from 'three';
import { apply, axis2Transform, type Vec3 } from './ifcMath';
import type { Profile } from './ifcSchemas';

// Polygons: the faces of B-reps and the profiles of extrusions, as triangles.

/** A closed loop of 2D points (the last point is not repeated). */
export type Loop2 = [number, number][];
/** A 2D area: its outline and its holes. */
export interface Area {
  outer: Loop2;
  holes: Loop2[];
}

const CIRCLE_SEGMENTS = 32;

/** Drops the closing point some polylines repeat. */
function open<T extends number[]>(points: T[]): T[] {
  const [first, last] = [points[0], points[points.length - 1]];
  const closed = points.length > 1 && first.every((v, i) => Math.abs(v - last[i]) < 1e-9);
  return closed ? points.slice(0, -1) : points;
}

/** Triangles of a 2D area, as index triples into `[outer, ...holes]` flattened (loops must be open). */
export function triangulateArea({ outer, holes }: Area): number[][] {
  const v = (loop: Loop2) => loop.map(([x, y]) => new Vector2(x, y));
  return ShapeUtils.triangulateShape(v(outer), holes.map(v));
}

/** Newell's normal of a 3D loop (its length is twice the loop's area). */
function newellNormal(loop: Vec3[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) {
    const [a, b] = [loop[i], loop[(i + 1) % loop.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/**
 * Triangles of a planar 3D polygon with holes, appended to `out` as flat
 * coordinates. The polygon is projected on the plane its normal is closest to.
 */
export function triangulateFace(outer: Vec3[], holes: Vec3[][], out: number[]): void {
  const loop = open(outer);
  if (loop.length < 3) return;
  if (loop.length === 3 && holes.length === 0) {
    for (const p of loop) out.push(...p);
    return;
  }
  const n = newellNormal(loop);
  const [ax, ay, az] = n.map(Math.abs);
  // The two axes kept, ordered so the projection keeps the loop's orientation.
  const [u, w] = az >= ax && az >= ay ? (n[2] > 0 ? [0, 1] : [1, 0]) : ax >= ay ? (n[0] > 0 ? [1, 2] : [2, 1]) : n[1] > 0 ? [2, 0] : [0, 2];
  const loops = [loop, ...holes.map((h) => open(h)).filter((h) => h.length >= 3)];
  const flat = loops.flat();
  const project = (l: Vec3[]): Loop2 => l.map((p) => [p[u], p[w]]);
  for (const tri of triangulateArea({ outer: project(loops[0]), holes: loops.slice(1).map(project) })) {
    for (const i of tri) out.push(...flat[i]);
  }
}

function rectangle(x: number, y: number): Loop2 {
  return [[-x / 2, -y / 2], [x / 2, -y / 2], [x / 2, y / 2], [-x / 2, y / 2]];
}

function circle(r: number): Loop2 {
  return Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

const polylineLoop = (curve: { points?: { coordinates: number[] }[] } | null | undefined): Loop2 =>
  open((curve?.points ?? []).map((p) => [p.coordinates[0] ?? 0, p.coordinates[1] ?? 0] as [number, number]));

/** The outline of a parametric profile, before its position. */
function rawArea(p: Profile): Area | null {
  const t = p.wallThickness ?? 0;
  switch (p.__typename) {
    case 'IfcRectangleProfileDef':
    case 'IfcRectangleHollowProfileDef':
      if (!p.xDim || !p.yDim) return null;
      return { outer: rectangle(p.xDim, p.yDim), holes: t > 0 ? [rectangle(p.xDim - 2 * t, p.yDim - 2 * t)] : [] };
    case 'IfcCircleProfileDef':
    case 'IfcCircleHollowProfileDef':
      if (!p.radius) return null;
      return { outer: circle(p.radius), holes: t > 0 && t < p.radius ? [circle(p.radius - t)] : [] };
    case 'IfcArbitraryClosedProfileDef':
    case 'IfcArbitraryProfileDefWithVoids':
      return { outer: polylineLoop(p.outerCurve), holes: (p.innerCurves ?? []).map(polylineLoop) };
    default:
      return null;
  }
}

/** The area a profile sweeps, in the profile's plane (its `position` applied). */
export function profileArea(p: Profile): Area | null {
  const area = rawArea(p);
  if (!area || area.outer.length < 3) return null;
  const m = axis2Transform(p.position);
  const place = (loop: Loop2): Loop2 => loop.map(([x, y]) => apply(m, x, y, 0).slice(0, 2) as [number, number]);
  return { outer: place(area.outer), holes: area.holes.filter((h) => h.length >= 3).map(place) };
}
