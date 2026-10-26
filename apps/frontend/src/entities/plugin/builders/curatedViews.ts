import { EXAMPLE_VIEWS } from '@fluid/shared';
import type { ViewBuilder } from '../viewBuilder';

/** The example views shipped with fluid, by concept name. */
export const curatedViewBuilder: ViewBuilder = {
  id: 'curated-views',
  label: 'Curated views',
  perspectives: ({ concept }) =>
    (EXAMPLE_VIEWS[concept.name] ?? []).map((spec) => ({ key: spec.id, title: spec.title, origin: 'curated', spec })),
};
