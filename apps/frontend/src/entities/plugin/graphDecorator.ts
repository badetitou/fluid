import type { DecoratorSpec } from '@fluid/shared';
import { graphDecoratorsOf, isEnabled } from './model';
import type { FluidPlugin } from './types';

/** The declarative graph decorators of the enabled plugins, in plugin order; the first of an id wins. */
export function activeGraphDecorators(plugins: FluidPlugin[], disabled: readonly string[] = []): DecoratorSpec[] {
  const seen = new Set<string>();
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap(graphDecoratorsOf)
    .filter((d) => !seen.has(d.id) && !!seen.add(d.id));
}
