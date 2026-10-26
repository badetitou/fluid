import type { ThemeDefinition, ThemeTokens } from '../../shared/theme';

// Catppuccin (https://catppuccin.com/palette): Latte is the light flavor,
// Frappé, Macchiato and Mocha the dark ones. Each theme pairs Latte with one
// dark flavor, so the light/dark switch keeps working.

/** The colours of a flavor that fluid uses, named as in the Catppuccin palette. */
export interface Flavor {
  blue: string;
  green: string;
  mauve: string;
  peach: string;
  red: string;
  teal: string;
  pink: string;
  yellow: string;
  sky: string;
  lavender: string;
  text: string;
  subtext1: string;
  subtext0: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
}

export const LATTE: Flavor = {
  blue: '#1e66f5', green: '#40a02b', mauve: '#8839ef', peach: '#fe640b', red: '#d20f39',
  teal: '#179299', pink: '#ea76cb', yellow: '#df8e1d', sky: '#04a5e5', lavender: '#7287fd',
  text: '#4c4f69', subtext1: '#5c5f77', subtext0: '#6c6f85', surface1: '#bcc0cc',
  surface0: '#ccd0da', base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8',
};

export const FRAPPE: Flavor = {
  blue: '#8caaee', green: '#a6d189', mauve: '#ca9ee6', peach: '#ef9f76', red: '#e78284',
  teal: '#81c8be', pink: '#f4b8e4', yellow: '#e5c890', sky: '#99d1db', lavender: '#babbf1',
  text: '#c6d0f5', subtext1: '#b5bfe2', subtext0: '#a5adce', surface1: '#51576d',
  surface0: '#414559', base: '#303446', mantle: '#292c3c', crust: '#232634',
};

export const MACCHIATO: Flavor = {
  blue: '#8aadf4', green: '#a6da95', mauve: '#c6a0f6', peach: '#f5a97f', red: '#ed8796',
  teal: '#8bd5ca', pink: '#f5bde6', yellow: '#eed49f', sky: '#91d7e3', lavender: '#b7bdf8',
  text: '#cad3f5', subtext1: '#b8c0e0', subtext0: '#a5adcb', surface1: '#494d64',
  surface0: '#363a4f', base: '#24273a', mantle: '#1e2030', crust: '#181926',
};

export const MOCHA: Flavor = {
  blue: '#89b4fa', green: '#a6e3a1', mauve: '#cba6f7', peach: '#fab387', red: '#f38ba8',
  teal: '#94e2d5', pink: '#f5c2e7', yellow: '#f9e2af', sky: '#89dceb', lavender: '#b4befe',
  text: '#cdd6f4', subtext1: '#bac2de', subtext0: '#a6adc8', surface1: '#45475a',
  surface0: '#313244', base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
};

/** fluid's tokens for a flavor: mauve accent, blue links, the palette's accents as series. */
export function flavorTokens(f: Flavor, mode: 'light' | 'dark'): ThemeTokens {
  const dark = mode === 'dark';
  return {
    primary: f.mauve,
    // Dark: panes sit on the darker mantle, cards on base, popups on surface0.
    surface: dark ? f.mantle : f.base,
    surfaceCard: dark ? f.base : f.mantle,
    surfaceElevated: dark ? f.surface0 : f.base,
    border: f.surface1,
    borderSubtle: f.surface0,
    ink: f.text,
    inkSecondary: f.subtext1,
    inkMuted: f.subtext0,
    link: f.blue,
    selected: f.surface0,
    gradient: [f.blue, f.mauve, f.pink],
    series: [f.blue, f.green, f.mauve, f.peach, f.red, f.teal, f.pink, f.yellow, f.sky, f.lavender],
    radius: 8,
  };
}

const theme = (id: string, label: string, dark: Flavor): ThemeDefinition => ({
  id: `catppuccin-${id}`,
  label: `Catppuccin ${label}`,
  description: `Soothing pastels: Latte in light mode, ${label} in dark mode.`,
  light: flavorTokens(LATTE, 'light'),
  dark: flavorTokens(dark, 'dark'),
});

/** The Catppuccin themes, from the lightest dark flavor to the darkest. */
export const CATPPUCCIN_THEMES: ThemeDefinition[] = [
  theme('frappe', 'Frappé', FRAPPE),
  theme('macchiato', 'Macchiato', MACCHIATO),
  theme('mocha', 'Mocha', MOCHA),
];
