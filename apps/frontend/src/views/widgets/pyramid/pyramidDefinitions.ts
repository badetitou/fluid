import type { PyramidMetricKey, PyramidRatioKey, PyramidWidget } from '@fluid/shared';

// The vocabulary of the Overview Pyramid (Lanza & Marinescu, "Object-Oriented
// Metrics in Practice"), as Moose's `OverviewPyramid` draws it.

export type Triple = readonly [low: number, average: number, high: number];
export type ThresholdPreset = NonNullable<PyramidWidget['thresholdPreset']>;

/** Abbreviation and full name of each metric. */
export const METRIC_NAMES: Record<PyramidMetricKey, { abbr: string; name: string }> = {
  nop: { abbr: 'NOP', name: 'Number of packages' },
  noc: { abbr: 'NOC', name: 'Number of classes' },
  nom: { abbr: 'NOM', name: 'Number of methods' },
  loc: { abbr: 'LOC', name: 'Lines of code' },
  cyclo: { abbr: 'CYCLO', name: 'Cyclomatic complexity' },
  calls: { abbr: 'CALLS', name: 'Number of method calls' },
  fanout: { abbr: 'FANOUT', name: 'Number of called classes' },
  andc: { abbr: 'ANDC', name: 'Average number of derived classes' },
  ahh: { abbr: 'AHH', name: 'Average hierarchy height' },
};

export interface RatioDefinition {
  /** The metric divided, and the one it is divided by (ANDC and AHH are their own ratio). */
  of: PyramidMetricKey;
  per?: PyramidMetricKey;
  name: string;
  description: string;
}

export const RATIOS: Record<PyramidRatioKey, RatioDefinition> = {
  nocNop: {
    of: 'noc',
    per: 'nop',
    name: 'High-level structuring (NOC/NOP)',
    description: 'Classes per package: are packages coarse or fine grained?',
  },
  nomNoc: {
    of: 'nom',
    per: 'noc',
    name: 'Class structuring (NOM/NOC)',
    description: 'Methods per class: how operations are distributed among classes.',
  },
  locNom: {
    of: 'loc',
    per: 'nom',
    name: 'Operation structuring (LOC/NOM)',
    description: 'Lines per method: how well the code is distributed among operations.',
  },
  cycloLoc: {
    of: 'cyclo',
    per: 'loc',
    name: 'Intrinsic operation complexity (CYCLO/LOC)',
    description: 'Conditional complexity per line of code.',
  },
  callsNom: {
    of: 'calls',
    per: 'nom',
    name: 'Coupling intensity (CALLS/NOM)',
    description: 'How many operations each operation calls, on average.',
  },
  fanoutCalls: {
    of: 'fanout',
    per: 'calls',
    name: 'Coupling dispersion (FANOUT/CALLS)',
    description: 'How many classes the calls involve.',
  },
  andc: {
    of: 'andc',
    name: 'Average number of derived classes (ANDC)',
    description: 'How extensively abstractions are refined by inheritance.',
  },
  ahh: {
    of: 'ahh',
    name: 'Average hierarchy height (AHH)',
    description: 'How deep the class hierarchies are.',
  },
};

/** Reference thresholds `[low, average, high]`, those of Moose (`OverviewPyramid class >> initialize*Treesholds`). */
export const THRESHOLD_PRESETS: Record<ThresholdPreset, Record<PyramidRatioKey, Triple>> = {
  java: {
    cycloLoc: [0.16, 0.2, 0.24],
    locNom: [7, 10, 13],
    nomNoc: [4, 7, 10],
    nocNop: [6, 17, 26],
    callsNom: [2.01, 2.62, 3.2],
    fanoutCalls: [0.56, 0.62, 0.68],
    andc: [0.25, 0.41, 0.57],
    ahh: [0.09, 0.21, 0.32],
  },
  cpp: {
    cycloLoc: [0.2, 0.25, 0.3],
    locNom: [5, 10, 16],
    nomNoc: [4, 9, 15],
    nocNop: [3, 19, 35],
    callsNom: [1.17, 1.58, 2],
    fanoutCalls: [0.2, 0.34, 0.48],
    andc: [0.19, 0.28, 0.37],
    ahh: [0.05, 0.13, 0.21],
  },
  smalltalk: {
    cycloLoc: [0.16, 0.22, 0.27],
    locNom: [4.92, 6.91, 8.9],
    nomNoc: [8.18, 11.24, 14.3],
    nocNop: [4.63, 8.57, 12.5],
    callsNom: [3.13, 5.46, 7.79],
    fanoutCalls: [0.15, 0.23, 0.31],
    andc: [0.37, 0.6, 0.83],
    ahh: [1.42, 2.22, 3.03],
  },
};
