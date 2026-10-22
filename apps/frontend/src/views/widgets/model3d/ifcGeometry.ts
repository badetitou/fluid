import { applyAll, axis3Transform, IDENTITY, multiply, normalize, operatorTransform, placementTransform, vec3, type Affine, type Vec3 } from './ifcMath';
import { profileArea, triangulateArea, triangulateFace, type Loop2 } from './ifcPolygons';
import {
  boxSchema,
  brepSchema,
  extrusionSchema,
  mappedItemSchema,
  productSchema,
  type Box,
  type Extrusion,
  type Face,
} from './ifcSchemas';

// IFC products as triangles, in world coordinates (IFC is Z-up). Supports the
// items buildings are mostly made of: faceted B-reps, extruded profiles,
// bounding boxes and mapped items (shared shapes placed several times).

const MAX_MAPPING_DEPTH = 4;

/** `out.push(...src)` without the spread, which overflows the stack on large shapes. */
function append(out: number[], src: number[]): void {
  for (let i = 0; i < src.length; i++) out.push(src[i]);
}

function brepTriangles(faces: Face[], out: number[]): void {
  for (const face of faces) {
    const loops = face.bounds.map((b) => ({
      outer: b.__typename === 'IfcFaceOuterBound',
      points: (b.bound?.polygon ?? []).map((p) => vec3(p.coordinates, [0, 0, 0])),
    }));
    const outerIndex = Math.max(0, loops.findIndex((l) => l.outer));
    const outer = loops[outerIndex];
    if (!outer) continue;
    triangulateFace(outer.points, loops.filter((_, i) => i !== outerIndex).map((l) => l.points), out);
  }
}

function extrusionTriangles(solid: Extrusion, out: number[]): void {
  const area = profileArea(solid.sweptArea);
  if (!area || solid.depth <= 0) return;
  const [dx, dy, dz] = normalize(vec3(solid.extrudedDirection?.directionRatios, [0, 0, 1])).map((v) => v * solid.depth) as Vec3;
  const points: number[] = [];
  const loops = [area.outer, ...area.holes];
  const flat = loops.flat();
  for (const tri of triangulateArea(area)) {
    for (const i of tri) points.push(flat[i][0], flat[i][1], 0);
    for (const i of [...tri].reverse()) points.push(flat[i][0] + dx, flat[i][1] + dy, dz);
  }
  const side = (loop: Loop2) =>
    loop.forEach(([ax, ay], i) => {
      const [bx, by] = loop[(i + 1) % loop.length];
      points.push(ax, ay, 0, bx, by, 0, bx + dx, by + dy, dz);
      points.push(ax, ay, 0, bx + dx, by + dy, dz, ax + dx, ay + dy, dz);
    });
  loops.forEach(side);
  append(out, applyAll(axis3Transform(solid.position), points));
}

function boxTriangles({ corner, xDim: x, yDim: y, zDim: z }: Box, out: number[]): void {
  const [ox, oy, oz] = vec3(corner?.coordinates, [0, 0, 0]);
  const c = (i: number): Vec3 => [ox + (i & 1 ? x : 0), oy + (i & 2 ? y : 0), oz + (i & 4 ? z : 0)];
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  for (const [a, b, d, e] of quads) out.push(...c(a), ...c(b), ...c(d), ...c(a), ...c(d), ...c(e));
}

/** Triangles of representation items, transformed by `m`; unknown or invalid items are skipped. */
function itemsTriangles(items: unknown[], m: Affine, out: number[], depth = 0): void {
  const local: number[] = [];
  for (const item of items) {
    const type = (item as { __typename?: unknown } | null)?.__typename;
    if (type === 'IfcFacetedBrep') {
      const brep = brepSchema.safeParse(item);
      if (brep.success) brepTriangles(brep.data.outer.cfsFaces, local);
    } else if (type === 'IfcExtrudedAreaSolid') {
      const solid = extrusionSchema.safeParse(item);
      if (solid.success) extrusionTriangles(solid.data, local);
    } else if (type === 'IfcBoundingBox') {
      const box = boxSchema.safeParse(item);
      if (box.success) boxTriangles(box.data, local);
    } else if (type === 'IfcMappedItem' && depth < MAX_MAPPING_DEPTH) {
      const mapped = mappedItemSchema.safeParse(item);
      if (!mapped.success) continue;
      const { mappingTarget, mappingSource } = mapped.data;
      const placed = multiply(operatorTransform(mappingTarget), axis3Transform(mappingSource.mappingOrigin));
      itemsTriangles(mappingSource.mappedRepresentation.items, placed, local, depth + 1);
    }
  }
  append(out, m === IDENTITY ? local : applyAll(m, local));
}

/** Representations to try, best first: the requested one, the body, any other, the bounding box last. */
function rankRepresentations<R extends { representationIdentifier?: string | null }>(reps: R[], preferred: string): R[] {
  const rank = (id: string | null | undefined) => (id === preferred ? 0 : id === 'Body' ? 1 : id === 'Box' ? 3 : 2);
  return [...reps].sort((a, b) => rank(a.representationIdentifier) - rank(b.representationIdentifier));
}

/**
 * The triangles of an IFC product, as flat world coordinates (9 numbers per
 * triangle), or null when it has no geometry the widgets can draw.
 */
export function productTriangles(product: unknown, preferred = 'Body'): Float32Array | null {
  const parsed = productSchema.safeParse(product);
  if (!parsed.success) return null;
  const { objectPlacement, representation } = parsed.data;
  const placement = placementTransform(objectPlacement);
  for (const rep of rankRepresentations(representation?.representations ?? [], preferred)) {
    const out: number[] = [];
    itemsTriangles(rep.items, IDENTITY, out);
    if (out.length > 0) return new Float32Array(applyAll(placement, out));
  }
  return null;
}
