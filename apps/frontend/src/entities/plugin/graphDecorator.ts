import type { DecoratorSpec } from '@fluid/shared';
import { graphDecoratorsOf, isEnabled } from './model';
import type { FluidPlugin } from './types';

/** A decorator with the manifest URL of its plugin, which its relative import URLs resolve against. */
export interface DecoratorEntry {
  spec: DecoratorSpec;
  baseUrl?: string;
}

/** The decorators of the enabled plugins, in plugin order, with their plugin's manifest URL; the first of an id wins. */
export function activeDecoratorEntries(plugins: FluidPlugin[], disabled: readonly string[] = []): DecoratorEntry[] {
  const seen = new Set<string>();
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap((p) => graphDecoratorsOf(p).map((spec) => ({ spec, baseUrl: p.source.kind === 'url' ? p.source.url : undefined })))
    .filter(({ spec }) => !seen.has(spec.id) && !!seen.add(spec.id));
}

/** The declarative graph decorators of the enabled plugins, in plugin order; the first of an id wins. */
export function activeGraphDecorators(plugins: FluidPlugin[], disabled: readonly string[] = []): DecoratorSpec[] {
  return activeDecoratorEntries(plugins, disabled).map((e) => e.spec);
}
