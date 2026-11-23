import type { RawClass } from './schema';

/** Thresholds of the heuristics, in one place so the dashboard can state them. */
export const THRESHOLDS = {
  /** A class this long (lines) is a "big class". */
  bigClassLines: 500,
  /** A class with this many methods is a "big class". */
  bigClassMethods: 30,
  /** A method this long (lines) is a "long method". */
  longMethodLines: 60,
} as const;

export interface MethodFact {
  name: string;
  lines: number;
  callers: number;
}

export interface ClassFact {
  key: string;
  name: string;
  file: string | null;
  kind: string;
  lines: number;
  /** Methods read for this class (the dashboard reads at most 300 per class). */
  methods: MethodFact[];
  methodCount: number;
  /** Relations pointing at the class (references, inheritance…). */
  referrers: number;
}

export interface DeadMethod {
  className: string;
  file: string | null;
  name: string;
  lines: number;
}

export interface Hotspot {
  cls: ClassFact;
  score: number;
  reasons: string[];
  longMethods: number;
  deadMethods: number;
}

export interface Dashboard {
  classCount: number;
  methodCount: number;
  totalLines: number;
  bigClasses: ClassFact[];
  longMethods: { className: string; name: string; lines: number }[];
  deadMethods: DeadMethod[];
  deadClasses: ClassFact[];
  hotspots: Hotspot[];
  /** Share (0–100) of project classes with no flag at all. */
  healthyPercent: number;
  /** Class count per size bucket, for the size distribution. */
  sizeBuckets: { label: string; count: number }[];
}

const span = (r: { startLine: number; endLine: number } | null): number => (r ? r.endLine - r.startLine + 1 : 0);

/** Methods the language calls implicitly: never reported as dead. */
const IMPLICIT = /^(main|toString|equals|hashCode|compareTo|clone|finalize|run|call|get|set|is|test\w*|setUp|tearDown|initialize|new)$/;
const looksImplicit = (name: string): boolean => IMPLICIT.test(name) || name.startsWith('<') || name.startsWith('__');

/** The project's own classes (libraries are `external`), reduced to the facts the dashboard uses. */
export function toFacts(raw: readonly RawClass[]): ClassFact[] {
  return raw
    .filter((c) => !c.external)
    .map((c) => ({
      key: c.key,
      name: c.name,
      file: c.file,
      kind: c.fineKind,
      lines: span(c.range),
      methods: c.children.nodes.map((m) => ({ name: m.name, lines: span(m.range), callers: m.incoming.totalCount })),
      methodCount: c.children.totalCount,
      referrers: c.incoming.totalCount,
    }));
}

const isBig = (c: ClassFact): boolean =>
  c.lines >= THRESHOLDS.bigClassLines || c.methodCount >= THRESHOLDS.bigClassMethods;

const deadOf = (c: ClassFact): MethodFact[] => c.methods.filter((m) => m.callers === 0 && !looksImplicit(m.name));
const longOf = (c: ClassFact): MethodFact[] => c.methods.filter((m) => m.lines >= THRESHOLDS.longMethodLines);

/** A class's technical-debt score and the reasons behind it (0 = nothing to report). */
export function hotspotOf(c: ClassFact): Hotspot {
  const dead = deadOf(c).length;
  const long = longOf(c).length;
  const reasons: string[] = [];
  if (c.lines >= THRESHOLDS.bigClassLines) reasons.push(`${c.lines} lines`);
  if (c.methodCount >= THRESHOLDS.bigClassMethods) reasons.push(`${c.methodCount} methods`);
  if (long > 0) reasons.push(`${long} long method${long > 1 ? 's' : ''}`);
  if (dead > 0) reasons.push(`${dead} unused method${dead > 1 ? 's' : ''}`);
  if (c.referrers === 0) reasons.push('never referenced');
  const score =
    c.lines / THRESHOLDS.bigClassLines + c.methodCount / THRESHOLDS.bigClassMethods + long * 0.5 + dead * 0.25 + (c.referrers === 0 ? 1 : 0);
  return { cls: c, score: reasons.length ? score : 0, reasons, longMethods: long, deadMethods: dead };
}

const BUCKETS: [string, number][] = [
  ['< 50', 50],
  ['50–149', 150],
  ['150–299', 300],
  ['300–499', 500],
  ['500+', Infinity],
];

/** Everything the dashboard shows, from the classes read. Pure: no query, no React. */
export function analyse(classes: readonly ClassFact[]): Dashboard {
  const hotspots = classes.map(hotspotOf).filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
  const flagged = new Set(hotspots.map((h) => h.cls.key));
  return {
    classCount: classes.length,
    methodCount: classes.reduce((n, c) => n + c.methodCount, 0),
    totalLines: classes.reduce((n, c) => n + c.lines, 0),
    bigClasses: classes.filter(isBig).sort((a, b) => b.lines - a.lines),
    longMethods: classes
      .flatMap((c) => longOf(c).map((m) => ({ className: c.name, name: m.name, lines: m.lines })))
      .sort((a, b) => b.lines - a.lines),
    deadMethods: classes
      .flatMap((c) => deadOf(c).map((m) => ({ className: c.name, file: c.file, name: m.name, lines: m.lines })))
      .sort((a, b) => b.lines - a.lines),
    deadClasses: classes.filter((c) => c.referrers === 0).sort((a, b) => b.lines - a.lines),
    hotspots,
    healthyPercent: classes.length ? Math.round(((classes.length - flagged.size) / classes.length) * 100) : 100,
    sizeBuckets: BUCKETS.map(([label, max], i) => ({
      label,
      count: classes.filter((c) => c.lines < max && c.lines >= (i ? BUCKETS[i - 1][1] : 0)).length,
    })),
  };
}
