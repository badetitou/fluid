import type { NodeHoverDrawingFunction } from 'sigma/rendering';
import type { NodeAttributes } from './networkGraph';
import type { NetworkPalette } from './networkStyle';

const PADDING = 3;

/**
 * Draws the hovered (or selected) node with its label on a card, in the theme's
 * colors (sigma's default card is white whatever the theme).
 */
export function drawNodeHover(palette: NetworkPalette): NodeHoverDrawingFunction<NodeAttributes> {
  return (context, data, settings) => {
    const size = settings.labelSize;
    context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    const label = typeof data.label === 'string' ? data.label : '';
    const width = label ? context.measureText(label).width + 2 * PADDING : 0;
    const height = size + 2 * PADDING;
    const radius = data.size + PADDING;

    context.fillStyle = palette.hoverBackground;
    context.strokeStyle = palette.hoverBorder;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(data.x, data.y, radius, 0, Math.PI * 2);
    if (label) context.rect(data.x + radius, data.y - height / 2, width, height);
    context.fill();
    context.stroke();

    context.fillStyle = data.color;
    context.beginPath();
    context.arc(data.x, data.y, data.size, 0, Math.PI * 2);
    context.fill();

    if (!label) return;
    context.fillStyle = palette.label;
    context.fillText(label, data.x + radius + PADDING, data.y + size / 3);
  };
}
