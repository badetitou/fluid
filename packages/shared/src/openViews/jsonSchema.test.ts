import { describe, expect, it } from 'vitest';
import committed from '../../../../docs/architecture/open-views.schema.json';
import { openViewsJsonSchema } from './jsonSchema';

describe('Open Views JSON Schema', () => {
  it('matches the committed file (run `pnpm --filter @fluid/shared schema:open-views`)', () => {
    expect(committed).toEqual(openViewsJsonSchema());
  });

  it('defines every protocol document', () => {
    const defs = openViewsJsonSchema().$defs as Record<string, unknown>;
    expect(Object.keys(defs)).toEqual(
      expect.arrayContaining(['ViewNode', 'Discovery', 'ObjectViewsResponse', 'ViewResponse', 'ViewItemsResponse']),
    );
  });
});
