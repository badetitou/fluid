import type { ConceptSchemaInfo } from './types';

// Hints about the shape of a concept's data, so the model picks the widgets made
// for it: a tree for hierarchies, richtext / Format "markdown"|"code" for long text.

const MARKDOWN_NAMES = /(markdown|readme|body|content|bodyText|changelog|notes|description)$/i;
const CODE_NAMES = /(sourceCode|snippet|script|codeSnippet|codeBlock|sql|stylesheet|dockerfile|json|yaml)$/i;
const TEXT_SCALARS = /^(markdown|md|richtext|json|jsonobject|jsonstring|code|sourcecode|yaml)$/i;

/** Self-referencing fields: a list of the concept itself (children) or a single one (parent). */
function hierarchyHints(schema: ConceptSchemaInfo): string[] {
  const self = schema.fields.filter((f) => !f.isScalar && f.typeName === schema.name);
  return self.map((f) =>
    f.isList
      ? `"${f.name}" lists more ${schema.name} (parent → children): show it with a "tree" widget, "childrenField": "${f.name}", selecting it 3-4 levels deep.`
      : `"${f.name}" points to the parent ${schema.name}: a "tree" widget over the list with "parentField": "${f.name}.id" builds the hierarchy.`,
  );
}

function textHints(schema: ConceptSchemaInfo): string[] {
  return schema.fields
    .filter((f) => f.isScalar && !f.isList)
    .flatMap((f) => {
      const desc = f.description ?? '';
      if (TEXT_SCALARS.test(f.typeName) || CODE_NAMES.test(f.name) || /source code|code snippet/i.test(desc)) {
        return [`"${f.name}" holds code: a "richtext" widget with "format": "code" (or Format "code" in a table).`];
      }
      if (f.typeName === 'String' && (MARKDOWN_NAMES.test(f.name) || /markdown/i.test(desc))) {
        return [`"${f.name}" holds long text, likely Markdown: a "richtext" widget with "format": "markdown".`];
      }
      return [];
    });
}

/** Structure hints for the prompt, or null when the concept has nothing special. */
export function renderStructureHints(schema: ConceptSchemaInfo): string | null {
  const hints = [...hierarchyHints(schema), ...textHints(schema)];
  return hints.length ? ['Structure hints:', ...hints.map((h) => `  - ${h}`)].join('\n') : null;
}
