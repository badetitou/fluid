import { asRows, getPath } from '../../data';
import { productTriangles } from './ifcGeometry';

// What the 3D widgets draw: one element per row that has geometry, with its
// label, category and id. Pure: the three.js side only turns these into meshes.

export type Row = Record<string, unknown>;

export interface Element3d {
  /** Unique within the scene (the id, or the row's index). */
  key: string;
  id?: string;
  label: string;
  category: string;
  row: Row;
  /** Flat world coordinates, 9 per triangle (IFC: Z up). */
  positions: Float32Array;
}

export interface ElementOptions {
  labelField?: string;
  colorField?: string;
  idField?: string;
  representation?: string;
  hiddenTypes?: string[];
}

/** Height of a 3D widget without an explicit one (px). */
export const DEFAULT_3D_HEIGHT = 360;

/** Elements hidden from a whole model by default: they are voids and volumes, not matter. */
export const DEFAULT_HIDDEN_TYPES = ['IfcOpeningElement', 'IfcSpace'];

const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined);

/** A row's id: `idField`, else `_id`, else `id`. */
export function idOf(row: unknown, idField?: string): string | undefined {
  return text(idField ? getPath(row, idField) : (getPath(row, '_id') ?? getPath(row, 'id')));
}

/** The drawable elements of `data` (one object or a list of IFC products). */
export function buildElements(data: unknown, options: ElementOptions = {}): Element3d[] {
  const hidden = new Set(options.hiddenTypes ?? []);
  const elements: Element3d[] = [];
  asRows(data).forEach((row, index) => {
    const type = text(row.__typename);
    if (type && hidden.has(type)) return;
    const positions = productTriangles(row, options.representation);
    if (!positions) return;
    const id = idOf(row, options.idField);
    const category = text(getPath(row, options.colorField ?? '__typename')) ?? 'Element';
    const label = text(options.labelField ? getPath(row, options.labelField) : (row.name ?? row.__typename)) ?? id ?? category;
    elements.push({ key: id ?? `#${index}`, id, label, category, row, positions });
  });
  return elements;
}

/** The ids to highlight: from objects (their id), lists of them, or plain ids. */
export function highlightIds(value: unknown, idField?: string): Set<string> {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const ids = values.map((v) => text(v) ?? idOf(v, idField)).filter((id): id is string => id !== undefined);
  return new Set(ids);
}

/** Categories in order of appearance, each with a color of the (non-empty) palette. */
export function categoryColors(elements: Element3d[], palette: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const { category } of elements) {
    if (!colors.has(category)) colors.set(category, palette[colors.size % palette.length]);
  }
  return colors;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** The box enclosing the elements, or null when there is nothing to enclose. */
export function boundsOf(elements: Element3d[]): Bounds | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const { positions } of elements) {
    for (let i = 0; i < positions.length; i++) {
      const k = i % 3;
      if (positions[i] < min[k]) min[k] = positions[i];
      if (positions[i] > max[k]) max[k] = positions[i];
    }
  }
  return min[0] === Infinity ? null : { min, max };
}
