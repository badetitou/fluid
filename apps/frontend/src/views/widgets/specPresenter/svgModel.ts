import type { ViewHotspot, ViewRef } from '@fluid/shared';

// The SVG of a Roassal canvas, made safe to inject and clickable: no script,
// no event handler, no external resource; entities (`data-fluid-ref`, and the
// hotspots Pharo listed) focusable, and the drawing at its own size, to be
// zoomed and panned in the widget.

export type SpecHotspot = ViewHotspot;

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Elements running code, embedding documents or rewriting attributes over time. */
const DROPPED = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'animate', 'animatemotion', 'animatetransform', 'set', 'discard', 'handler', 'listener']);
const LINK_ATTRIBUTES = /^(xlink:)?href$|^src$/i;
const EXTERNAL_URL = /url\(\s*(?!['"]?#)[^)]*\)/gi;
const IMPORT = /@import[^;]*;?/gi;

/** Whether an attribute is safe to keep. */
function safeAttribute(name: string, value: string): boolean {
  if (/^on/i.test(name)) return false;
  if (LINK_ATTRIBUTES.test(name)) return value.trim().startsWith('#');
  return !/javascript:/i.test(value);
}

function clean(element: Element): void {
  for (const child of Array.from(element.children)) {
    if (DROPPED.has(child.localName.toLowerCase())) child.remove();
    else clean(child);
  }
  for (const attribute of Array.from(element.attributes)) {
    if (!safeAttribute(attribute.name, attribute.value)) element.removeAttribute(attribute.name);
    else if (attribute.name === 'style') element.setAttribute('style', attribute.value.replace(EXTERNAL_URL, 'none'));
  }
  if (element.localName === 'style') element.textContent = (element.textContent ?? '').replace(IMPORT, '').replace(EXTERNAL_URL, 'none');
}

export interface SanitizedSvg {
  markup: string;
  /** Size of the drawing in pixels: its width and height, else those of its viewBox. */
  width: number;
  height: number;
}

/** The root at a fixed pixel size (from its viewBox when it has none), so that the zoom scales it as a whole. */
function fixSize(root: Element): { width: number; height: number } {
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(parseFloat);
  const size = (attribute: 'width' | 'height', fromViewBox: number | undefined) => {
    const value = parseFloat(root.getAttribute(attribute) ?? '');
    return value > 0 ? value : fromViewBox !== undefined && fromViewBox > 0 ? fromViewBox : 0;
  };
  const width = size('width', viewBox[2]);
  const height = size('height', viewBox[3]);
  if (!root.hasAttribute('viewBox') && width > 0 && height > 0) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (width > 0 && height > 0) {
    root.setAttribute('width', String(width));
    root.setAttribute('height', String(height));
  }
  return { width, height };
}

const MIN_FRAME = 120;
const MAX_FRAME = 600;
const FALLBACK_FRAME = 320;

/** Height of the frame showing a drawing at the scale it first appears in a frame `viewWidth` wide (at most 1:1, at least `minScale`). */
export function frameHeight(drawing: { width: number; height: number }, viewWidth: number, minScale: number): number {
  if (drawing.width <= 0 || drawing.height <= 0 || viewWidth <= 0) return FALLBACK_FRAME;
  const scale = Math.max(minScale, Math.min(1, viewWidth / drawing.width));
  return Math.round(Math.min(MAX_FRAME, Math.max(MIN_FRAME, drawing.height * scale)));
}

function addHotspots(root: Element, hotspots: SpecHotspot[]): void {
  for (const spot of hotspots) {
    const rect = root.ownerDocument.createElementNS(SVG_NS, 'rect');
    for (const [name, value] of Object.entries({ x: spot.x, y: spot.y, width: spot.width, height: spot.height })) {
      rect.setAttribute(name, String(value));
    }
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('data-fluid-ref', spot.ref.id);
    if (spot.ref.type) rect.setAttribute('data-fluid-type', spot.ref.type);
    rect.setAttribute('data-fluid-hotspot', '');
    root.appendChild(rect);
  }
}

/** Entities reachable with the keyboard, named for screen readers. */
function markEntities(root: Element): void {
  for (const element of Array.from(root.querySelectorAll('[data-fluid-ref]'))) {
    const ref = readRef(element);
    if (!ref) continue;
    const text = element.textContent?.trim();
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'link');
    element.setAttribute('aria-label', text || `${ref.type ?? 'Entity'} ${ref.id}`);
  }
}

/**
 * `svg` without anything executable or external, at a fixed size, `hotspots`
 * added as transparent clickable rectangles on top; undefined when it is not
 * an SVG document.
 */
export function sanitizeSvg(svg: string, hotspots: SpecHotspot[] = []): SanitizedSvg | undefined {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  if (root.localName !== 'svg' || document.getElementsByTagName('parsererror').length > 0) return undefined;
  clean(root);
  const size = fixSize(root);
  addHotspots(root, hotspots);
  markEntities(root);
  return { markup: new XMLSerializer().serializeToString(root), ...size };
}

/** The entity an element of the drawing (or one of its ancestors) stands for. */
export function readRef(element: Element | null): ViewRef | undefined {
  const holder = element?.closest('[data-fluid-ref]');
  const id = holder?.getAttribute('data-fluid-ref');
  if (!holder || !id) return undefined;
  const type = holder.getAttribute('data-fluid-type');
  return type ? { id, type } : { id };
}
