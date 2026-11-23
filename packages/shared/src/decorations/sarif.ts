import { z } from 'zod';
import type { DecoratedNode, Finding } from './graph';
import type { Severity } from './schema';

// -----------------------------------------------------------------------------
// SARIF 2.1.0 (the subset we read) -> findings attached to graph nodes
// -----------------------------------------------------------------------------

const regionSchema = z
  .object({
    startLine: z.number().optional(),
    endLine: z.number().optional(),
    startColumn: z.number().optional(),
    endColumn: z.number().optional(),
  })
  .passthrough();

const locationSchema = z
  .object({
    physicalLocation: z
      .object({
        artifactLocation: z
          .object({ uri: z.string().optional(), uriBaseId: z.string().optional() })
          .passthrough()
          .optional(),
        region: regionSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const ruleSchema = z
  .object({
    id: z.string(),
    shortDescription: z.object({ text: z.string().optional() }).passthrough().optional(),
    defaultConfiguration: z.object({ level: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

const resultSchema = z
  .object({
    ruleId: z.string().optional(),
    ruleIndex: z.number().optional(),
    level: z.string().optional(),
    message: z.object({ text: z.string().optional() }).passthrough().optional(),
    locations: z.array(locationSchema).optional(),
  })
  .passthrough();

const runSchema = z
  .object({
    tool: z
      .object({
        driver: z
          .object({ name: z.string().optional(), rules: z.array(ruleSchema).optional() })
          .passthrough(),
      })
      .passthrough()
      .optional(),
    results: z.array(resultSchema).optional(),
    originalUriBaseIds: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const sarifLogSchema = z.object({ runs: z.array(runSchema) }).passthrough();
export type SarifLog = z.infer<typeof sarifLogSchema>;

export interface PathOptions {
  stripPrefix?: string | string[];
  addPrefix?: string;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function normalizeArtifactPath(uri: string, options: PathOptions = {}): string {
  let p = safeDecode(uri).replace(/\\/g, '/');
  p = p.replace(/^file:\/\/(?=\/|[A-Za-z]:)/i, '').replace(/^file:\/*/i, '/');
  p = p.replace(/^\.\//, '');
  const prefixes = Array.isArray(options.stripPrefix)
    ? options.stripPrefix
    : options.stripPrefix
      ? [options.stripPrefix]
      : [];
  for (const raw of prefixes) {
    const prefix = raw.replace(/\\/g, '/');
    if (prefix && p.startsWith(prefix)) {
      p = p.slice(prefix.length).replace(/^\/+/, '');
      break;
    }
  }
  if (options.addPrefix) {
    p = `${options.addPrefix.replace(/\/+$/, '')}/${p.replace(/^\/+/, '')}`;
  }
  return p;
}

export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface SarifOptions extends PathOptions {
  decoratorId: string;
  rangeOf?: (node: DecoratedNode) => LineRange | undefined;
  kinds?: string[];
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Reads `props.range` (model-graphql shape), then `props.startLine/endLine`. */
export function defaultRangeOf(node: DecoratedNode): LineRange | undefined {
  const props = node.props ?? {};
  const range = props.range;
  const r = range && typeof range === 'object' ? (range as Record<string, unknown>) : undefined;
  const startLine = num(r?.startLine) ?? num(props.startLine);
  const endLine = num(r?.endLine) ?? num(props.endLine);
  if (startLine === undefined) return undefined;
  return { startLine, endLine: endLine ?? startLine };
}

function toSeverity(level: string | undefined): Severity | undefined {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warning';
  if (level === 'note' || level === 'none') return 'info';
  return undefined;
}

interface Span extends LineRange {
  key: string;
}

interface FileIndex {
  spans: Span[];
  fileNode?: string;
}

function buildIndex(nodes: DecoratedNode[], options: SarifOptions): Map<string, FileIndex> {
  const rangeOf = options.rangeOf ?? defaultRangeOf;
  const index = new Map<string, FileIndex>();
  for (const node of nodes) {
    if (!node.file) continue;
    if (options.kinds && !(node.kind && options.kinds.includes(node.kind))) continue;
    const file = normalizeArtifactPath(node.file);
    const entry = index.get(file) ?? { spans: [] };
    index.set(file, entry);
    if (node.kind === 'FILE') {
      if (entry.fileNode === undefined || node.key < entry.fileNode) entry.fileNode = node.key;
      continue;
    }
    const range = rangeOf(node);
    if (range) entry.spans.push({ key: node.key, ...range });
  }
  return index;
}

function innermost(entry: FileIndex, line: number): string | undefined {
  let best: Span | undefined;
  for (const s of entry.spans) {
    if (line < s.startLine || line > s.endLine) continue;
    const size = s.endLine - s.startLine;
    const bestSize = best ? best.endLine - best.startLine : Infinity;
    if (size < bestSize || (size === bestSize && best && s.key < best.key)) best = s;
  }
  return best?.key ?? entry.fileNode;
}

export function sarifToFindings(
  log: SarifLog,
  nodes: DecoratedNode[],
  options: SarifOptions,
): { findings: { key: string; finding: Finding }[]; unmatched: number } {
  const index = buildIndex(nodes, options);
  const findings: { key: string; finding: Finding }[] = [];
  let unmatched = 0;
  for (const run of log.runs) {
    const rules = run.tool?.driver.rules ?? [];
    for (const result of run.results ?? []) {
      const rule = result.ruleIndex !== undefined ? rules[result.ruleIndex] : undefined;
      const ruleId = result.ruleId ?? rule?.id ?? 'unknown';
      const physical = result.locations?.[0]?.physicalLocation;
      const uri = physical?.artifactLocation?.uri;
      const line = physical?.region?.startLine;
      const entry = uri ? index.get(normalizeArtifactPath(uri, options)) : undefined;
      const key = entry ? innermost(entry, line ?? 0) : undefined;
      if (!key) {
        unmatched++;
        continue;
      }
      const severity =
        toSeverity(result.level) ?? toSeverity(rule?.defaultConfiguration?.level) ?? 'warning';
      const text = result.message?.text ?? rule?.shortDescription?.text ?? ruleId;
      findings.push({
        key,
        finding: {
          decoratorId: options.decoratorId,
          ruleId,
          severity,
          message: line !== undefined ? `L${line}: ${text}` : text,
        },
      });
    }
  }
  return { findings, unmatched };
}
