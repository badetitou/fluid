import { EXAMPLE_VIEWS } from '@fluid/shared';
import type { ViewBuilder } from '../viewBuilder';
import { fitsSource } from './sourceFit';

/**
 * The example views shipped with fluid, by concept name: only those whose queries the source can
 * answer, once its root fields are known (a Moose `Class` example is not offered on a Model source).
 */
export const curatedViewBuilder: ViewBuilder = {
  id: 'curated-views',
  label: 'Curated views',
  perspectives: ({ concept, rootFields }) =>
    (EXAMPLE_VIEWS[concept.name] ?? [])
      .filter((spec) => !rootFields || fitsSource(spec, rootFields))
      .map((spec) => ({ key: spec.id, title: spec.title, origin: 'curated', spec })),
};
