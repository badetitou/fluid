import { describe, expect, it } from 'vitest';
import { themeDefinitionSchema, tokensFor } from '../../shared/theme';
import { BUILTIN_PLUGINS } from './builtin';
import { CATPPUCCIN_THEMES, flavorTokens, LATTE, MOCHA } from './catppuccin';
import { themesOf } from './model';

describe('Catppuccin themes', () => {
  it.each(CATPPUCCIN_THEMES)('$id is a valid theme with both modes', (theme) => {
    expect(themeDefinitionSchema.safeParse(theme).error?.issues ?? []).toEqual([]);
    expect(tokensFor(theme, 'light').tokens).toEqual(flavorTokens(LATTE, 'light'));
    expect(tokensFor(theme, 'dark').mode).toBe('dark');
  });

  it('ship as one built-in plugin', () => {
    const plugin = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'fluid-theme-catppuccin');
    expect(plugin && themesOf(plugin).map((t) => t.id)).toEqual([
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
    ]);
  });

  it('lay dark panes on mantle, cards on base, with the mauve accent', () => {
    const tokens = flavorTokens(MOCHA, 'dark');
    expect([tokens.surface, tokens.surfaceCard, tokens.primary]).toEqual([
      MOCHA.mantle,
      MOCHA.base,
      MOCHA.mauve,
    ]);
  });
});
