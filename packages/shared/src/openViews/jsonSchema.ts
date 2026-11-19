// -----------------------------------------------------------------------------
// fluid Open Views — JSON Schema export
// -----------------------------------------------------------------------------
// Providers in other languages validate against the JSON Schema generated from
// the zod schemas: `pnpm --filter @fluid/shared schema:open-views` writes it
// to `docs/architecture/open-views.schema.json` (checked by a test).

import { z } from 'zod';
import { viewItemSchema, viewRefSchema } from './items';
import { viewNodeSchema } from './nodes';
import {
  objectViewsResponseSchema,
  openViewsDiscoverySchema,
  openViewsErrorSchema,
  viewActionResultSchema,
  viewEvaluationRequestSchema,
  viewEvaluationSchema,
  viewItemsResponseSchema,
  viewResponseSchema,
} from './protocol';

/** The documents of the protocol, by the name they take in the JSON Schema's `$defs`. */
const DOCUMENTS = {
  ViewRef: viewRefSchema,
  ViewItem: viewItemSchema,
  ViewNode: viewNodeSchema,
  Discovery: openViewsDiscoverySchema,
  ObjectViewsResponse: objectViewsResponseSchema,
  ViewResponse: viewResponseSchema,
  ViewItemsResponse: viewItemsResponseSchema,
  ViewActionResult: viewActionResultSchema,
  EvaluationRequest: viewEvaluationRequestSchema,
  Evaluation: viewEvaluationSchema,
  Error: openViewsErrorSchema,
};

export const OPEN_VIEWS_SCHEMA_ID = 'https://github.com/badetitou/fluid/docs/architecture/open-views.schema.json';

/** The JSON Schema (draft 2020-12) of protocol v1: every document under `$defs`. */
export function openViewsJsonSchema(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(DOCUMENTS)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { target: 'draft-2020-12', io: 'input', uri: (id) => `#/$defs/${id}` });
  const defs: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    const { $schema: _ignored, $id: _id, ...rest } = schema as Record<string, unknown>;
    defs[id] = rest;
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: OPEN_VIEWS_SCHEMA_ID,
    title: 'fluid Open Views, protocol v1',
    $defs: defs,
  };
}
