import type { SpecFluidNode, SpecFluidRef } from '@fluid/shared';

// The SVG of a Roassal canvas, made safe to inject and clickable: no script,
// no event handler, no external resource; entities (`data-fluid-ref`, and the
// hotspots Pharo listed) focusable, and the drawing scaled to the widget width.

export type SpecHotspot = NonNullable<Extract<SpecFluidNode, { kind: 'svg' }>['refs']>[number];

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

/** The root sized by the widget: a viewBox from its pixel size, no fixed width or height. */
function fitToWidth(root: Element): void {
  const width = parseFloat(root.getAttribute('width') ?? '');
  const height = parseFloat(root.getAttribute('height') ?? '');
  if (!root.hasAttribute('viewBox') && width > 0 && height > 0) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.removeAttribute('width');
  root.removeAttribute('height');
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
 * `svg` without anything executable or external, scaled to its container,
 * `hotspots` added as transparent clickable rectangles on top; undefined when
 * it is not an SVG document.
 */
export function sanitizeSvg(svg: string, hotspots: SpecHotspot[] = []): string | undefined {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  if (root.localName !== 'svg' || document.getElementsByTagName('parsererror').length > 0) return undefined;
  clean(root);
  fitToWidth(root);
  addHotspots(root, hotspots);
  markEntities(root);
  return new XMLSerializer().serializeToString(root);
}

/** The entity an element of the drawing (or one of its ancestors) stands for. */
export function readRef(element: Element | null): SpecFluidRef | undefined {
  const holder = element?.closest('[data-fluid-ref]');
  const id = holder?.getAttribute('data-fluid-ref');
  if (!holder || !id) return undefined;
  const type = holder.getAttribute('data-fluid-type');
  return type ? { id, type } : { id };
}
