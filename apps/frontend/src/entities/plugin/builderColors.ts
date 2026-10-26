import type { FluidPlugin } from './types';

/** Colours given in turn to the view builders that declare none. */
export const BUILDER_PALETTE = ['#13c2c2', '#fa541c', '#a0d911', '#2f54eb', '#fadb14'] as const;

/** A colour as the colour picker gives it and a manifest may declare it: `#rrggbb`. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The colour of every view builder the plugins declare, by builder id: the
 * user's choice, else the builder's own, else the next colour of the palette.
 */
export function builderColors(
  plugins: readonly FluidPlugin[],
  chosen: Readonly<Record<string, string>>,
): Map<string, string> {
  const colors = new Map<string, string>();
  let next = 0;
  for (const plugin of plugins) {
    for (const { id, color } of plugin.manifest.contributes.viewBuilders ?? []) {
      const own = color ?? BUILDER_PALETTE[next++ % BUILDER_PALETTE.length];
      const pick = chosen[id];
      colors.set(id, pick && HEX_COLOR.test(pick) ? pick : own);
    }
  }
  return colors;
}
