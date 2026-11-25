import type { HierarchyGraph, HierarchyNode } from './hierarchyModel';

/** Colors needed by the 2D box layer (resolved from the widget theme). */
export interface BoxPalette {
  border: string;
  subtle: string;
  surface: string;
  ink: string;
  muted: string;
  selection: string;
}

export interface BoxOptions {
  hovered?: string;
  selected?: string;
  width: number;
  height: number;
}

type Project = (x: number, y: number) => { x: number; y: number };

const LABEL_SCALE = 0.45;

/** Draws containment and expanded-node boxes in the same viewport as sigma's WebGL nodes. */
export function drawHierarchyBoxes(
  ctx: CanvasRenderingContext2D,
  hierarchy: HierarchyGraph,
  project: Project,
  palette: BoxPalette,
  options: BoxOptions,
): void {
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.lineWidth = 1;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const node of hierarchy.nodes) {
    if (node.kind === 'leaf' && !isOpen(node)) continue;
    if (node.kind === 'root' && hierarchy.nodes.length > 2000) continue;
    drawBox(ctx, node, project, palette, options);
  }
}

function isOpen(node: HierarchyNode): boolean {
  return node.kind !== 'leaf' || node.width > 200;
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  node: HierarchyNode,
  project: Project,
  palette: BoxPalette,
  options: BoxOptions,
): void {
  const topLeft = project(node.x, node.y);
  const bottomRight = project(node.x + node.width, node.y + node.height);
  if (
    bottomRight.x < -40 ||
    bottomRight.y < -40 ||
    topLeft.x > options.width + 40 ||
    topLeft.y > options.height + 40
  ) {
    return;
  }
  const scale = (bottomRight.x - topLeft.x) / node.width;
  const active = options.selected === node.key || options.hovered === node.key;
  ctx.fillStyle = node.kind === 'leaf' ? palette.surface : withAlpha(palette.surface, 0.72);
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.strokeStyle = active ? palette.selection : node.kind === 'leaf' ? palette.border : palette.subtle;
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  if (scale < LABEL_SCALE || node.kind === 'root') return;
  const header = Math.min(28 * scale, 28);
  ctx.fillStyle = withAlpha(palette.surface, 0.94);
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, header);
  ctx.fillStyle = active ? palette.selection : palette.ink;
  ctx.fillText(labelOf(node), topLeft.x + 8, topLeft.y + header / 2, Math.max(0, bottomRight.x - topLeft.x - 16));
  if (node.kind === 'container' && scale > 0.7) {
    ctx.fillStyle = palette.muted;
    ctx.font = '11px system-ui, sans-serif';
    const text = `${node.count}`;
    ctx.fillText(text, bottomRight.x - 8 - ctx.measureText(text).width, topLeft.y + header / 2);
    ctx.font = '600 12px system-ui, sans-serif';
  }
}

const labelOf = (node: HierarchyNode): string =>
  node.kind === 'leaf' ? node.label : `${node.label} — ${node.count}`;

/** Canvas 2D cannot parse `color-mix`; keep the surface translucent with a hex/rgb alpha suffix. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4 ? color.slice(1).split('').map((c) => c + c).join('') : color.slice(1);
    const value = Number.parseInt(hex, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(color);
  if (rgb) {
    const parts = rgb[1].split(',').slice(0, 3).join(',');
    return `rgba(${parts}, ${alpha})`;
  }
  return color;
}

export { withAlpha };
