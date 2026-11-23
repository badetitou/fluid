import type { DecoratorSpec } from '@fluid/shared';
import { isEnabled, graphDecoratorsOf } from './model';
import type { FluidPlugin } from './types';

/** The declarative graph decorators of the enabled plugins, in plugin order. */
export function activeGraphDecorators(plugins: FluidPlugin[], disabled: readonly string[] = []): DecoratorSpec[] {
  return plugins.filter((p) => isEnabled(p, disabled)).flatMap(graphDecoratorsOf);
}
