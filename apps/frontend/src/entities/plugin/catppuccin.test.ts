import { describe, expect, it } from 'vitest';
import { themeDefinitionSchema, tokensFor } from '../../shared/theme';
import { BUILTIN_PLUGINS } from './builtin';
import {
  CATPPUCCIN_THEMES,
  flavorTokens,
  LATTE,
  MATCHA,
  MATCHA_LATTE,
  matchaTokens,
  MOCHA,
} from './catppuccin';
import { themesOf } from './model';

describe('Catppuccin themes', () => {
  it.each(CATPPUCCIN_THEMES)('$id is a valid theme with both modes', (theme) => {
    expect(themeDefinitionSchema.safeParse(theme).error?.issues ?? []).toEqual([]);
    expect(tokensFor(theme, 'dark').mode).toBe('dark');
  });

  it('pair the official dark flavors with Latte', () => {
    const official = CATPPUCCIN_THEMES.filter((t) => t.id !== 'catppuccin-matcha');
    for (const theme of official) {
      expect(tokensFor(theme, 'light').tokens).toEqual(flavorTokens(LATTE, 'light'));
    }
  });

  it('give Matcha a matcha green accent in both modes', () => {
    const matcha = CATPPUCCIN_THEMES.find((t) => t.id === 'catppuccin-matcha');
    expect(matcha && tokensFor(matcha, 'light').tokens.primary).toBe(MATCHA_LATTE.green);
    expect(matcha && tokensFor(matcha, 'dark').tokens).toEqual(matchaTokens(MATCHA, 'dark'));
  });

  it('ship as one built-in plugin', () => {
    const plugin = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'fluid-theme-catppuccin');
    expect(plugin && themesOf(plugin).map((t) => t.id)).toEqual([
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
      'catppuccin-matcha',
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
