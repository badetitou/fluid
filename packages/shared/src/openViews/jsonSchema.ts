// -----------------------------------------------------------------------------
// fluid Open Views — JSON Schema export
// -----------------------------------------------------------------------------
// Providers in other languages validate against the JSON Schema generated from
// the zod schemas: `pnpm --filter @fluid/shared schema:open-views` writes it
// to `docs/architecture/open-views.schema.json` (checked by a test).

import { z } from 'zod';
import { viewItemSchema, viewRefSchema } from './items';
import { VIEW_NODE_KINDS, viewNodeSchema } from './nodes';
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

/** A node of a kind fluid does not know is valid (it is shown as `unsupported`, see `unknownKindAsUnsupported`). */
function acceptUnknownKinds(jsonSchema: Record<string, unknown>): void {
  const known = { ...jsonSchema };
  for (const key of Object.keys(jsonSchema)) delete jsonSchema[key];
  jsonSchema.anyOf = [
    known,
    {
      type: 'object',
      properties: { kind: { type: 'string', not: { enum: [...VIEW_NODE_KINDS] } } },
      required: ['kind'],
    },
  ];
}

/** The JSON Schema (draft 2020-12) of protocol v1: every document under `$defs`. */
export function openViewsJsonSchema(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(DOCUMENTS)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, {
    target: 'draft-2020-12',
    io: 'input',
    uri: (id) => `#/$defs/${id}`,
    override: ({ zodSchema, jsonSchema }) => {
      if ((zodSchema as unknown) === viewNodeSchema) acceptUnknownKinds(jsonSchema);
    },
  });
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
