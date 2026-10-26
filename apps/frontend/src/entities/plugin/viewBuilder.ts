import type { ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../graphql/introspection';
import type { DataSource } from '../../views/plugin-api';
import type { ColumnKind } from '../../views/viewScope';

/** What a view builder knows of the column it proposes perspectives for. */
export interface ViewBuilderContext {
  concept: Concept;
  columnKind: ColumnKind;
  /** The item shown, in a detail column. */
  itemId?: string;
  conceptByName: Map<string, Concept>;
  queriesByType: Map<string, ConceptQueries>;
  /** The source accepts writes (mutations). */
  writable: boolean;
  /** The plugin's settings, as the user filled them in Settings → Plugins. */
  settings: Readonly<Record<string, string>>;
}

/** How a perspective was made, shown on its pill. */
export type PerspectiveOrigin = 'curated' | 'auto' | 'remote';

/** A perspective a builder proposes. */
export interface Perspective {
  /** Unique among the column's perspectives (prefix it with the builder id). */
  key: string;
  title: string;
  origin: PerspectiveOrigin;
  spec: ViewSpec;
  /** Shown first, and by default, in columns of this kind. */
  defaultFor?: ColumnKind;
}

/**
 * The code half of a view builder: `perspectives` when it only reads the
 * column (auto views), `fetchPerspectives` when it asks a backend.
 */
export interface ViewBuilder {
  id: string;
  label: string;
  perspectives?: (context: ViewBuilderContext) => Perspective[];
  fetchPerspectives?: (context: ViewBuilderContext, signal: AbortSignal) => Promise<Perspective[]>;
  /** The backend its perspectives' queries name in `source`, bound to the plugin's settings. */
  dataSource?: (settings: Readonly<Record<string, string>>) => DataSource;
}
