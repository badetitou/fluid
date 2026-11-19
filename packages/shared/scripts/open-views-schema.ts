// Writes the JSON Schema of fluid Open Views to docs/architecture/open-views.schema.json.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openViewsJsonSchema } from '../src/openViews/jsonSchema';

const target = fileURLToPath(new URL('../../../docs/architecture/open-views.schema.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(openViewsJsonSchema(), null, 2)}\n`);
console.log(`wrote ${target}`);
