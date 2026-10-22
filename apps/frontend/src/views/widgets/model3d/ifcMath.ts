import type { Axis2, Axis3, LocalPlacement, TransformOperator } from './ifcSchemas';

// Affine transforms as IFC placements build them. A transform is a 3×4 matrix,
// row-major: [xx, yx, zx, tx,  xy, yy, zy, ty,  xz, yz, zz, tz], where the
// columns are the images of the X, Y and Z axes and of the origin.

export type Vec3 = [number, number, number];
export type Affine = number[];

export const IDENTITY: Affine = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export const vec3 = (values: number[] | undefined, fallback: Vec3): Vec3 =>
  values && values.length > 0 ? [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0] : fallback;

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(...a);
  return length > 1e-12 ? scale(a, 1 / length) : a;
}

/** The transform whose axes are x, y, z (already scaled) and whose origin is `o`. */
export const fromAxes = (x: Vec3, y: Vec3, z: Vec3, o: Vec3): Affine => [
  x[0], y[0], z[0], o[0],
  x[1], y[1], z[1], o[1],
  x[2], y[2], z[2], o[2],
];

/** `a ∘ b`: applies `b`, then `a`. */
export function multiply(a: Affine, b: Affine): Affine {
  const out = new Array<number>(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      out[r * 4 + c] =
        a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0);
    }
  }
  return out;
}

export function apply(m: Affine, x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

/** Applies `m` to a flat list of points [x0, y0, z0, x1, …], in place. */
export function applyAll(m: Affine, points: number[]): number[] {
  for (let i = 0; i < points.length; i += 3) {
    const [x, y, z] = apply(m, points[i], points[i + 1], points[i + 2]);
    points[i] = x;
    points[i + 1] = y;
    points[i + 2] = z;
  }
  return points;
}

/** IfcAxis2Placement3D: Z from `axis`, X from `refDirection` made orthogonal to it. */
export function axis3Transform(p: Axis3 | null | undefined): Affine {
  if (!p) return IDENTITY;
  const z = normalize(vec3(p.axis?.directionRatios, [0, 0, 1]));
  const ref = vec3(p.refDirection?.directionRatios, Math.abs(z[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const x = normalize(sub(ref, scale(z, dot(ref, z))));
  return fromAxes(x, cross(z, x), z, vec3(p.location?.coordinates, [0, 0, 0]));
}

/** IfcAxis2Placement2D, in the XY plane. */
export function axis2Transform(p: Axis2 | null | undefined): Affine {
  if (!p) return IDENTITY;
  const [dx, dy] = vec3(p.refDirection?.directionRatios, [1, 0, 0]);
  const length = Math.hypot(dx, dy) || 1;
  const [ox, oy] = vec3(p.location?.coordinates, [0, 0, 0]);
  return fromAxes([dx / length, dy / length, 0], [-dy / length, dx / length, 0], [0, 0, 1], [ox, oy, 0]);
}

/** IfcLocalPlacement: its relative placement, within the placement it is relative to. */
export function placementTransform(p: LocalPlacement | null | undefined, depth = 0): Affine {
  if (!p || depth > 32) return IDENTITY;
  return multiply(placementTransform(p.placementRelTo, depth + 1), axis3Transform(p.relativePlacement));
}

/** IfcCartesianTransformationOperator3D(nonUniform), the target of a mapped item. */
export function operatorTransform(t: TransformOperator | null | undefined): Affine {
  if (!t) return IDENTITY;
  const z = normalize(vec3(t.axis3?.directionRatios, [0, 0, 1]));
  const x1 = vec3(t.axis1?.directionRatios, Math.abs(z[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const x = normalize(sub(x1, scale(z, dot(x1, z))));
  const y = cross(z, x);
  const s = t.scale ?? 1;
  return fromAxes(scale(x, s), scale(y, t.scale2 ?? s), scale(z, t.scale3 ?? s), vec3(t.localOrigin?.coordinates, [0, 0, 0]));
}

