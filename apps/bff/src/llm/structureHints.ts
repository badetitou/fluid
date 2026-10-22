import { SUPERCLASS_FIELD_NAMES } from '@fluid/shared';
import type { ConceptSchemaInfo } from './types';

// Hints about the shape of a concept's data, so the model picks the widgets made
// for it: a tree for hierarchies, a class diagram for inheritance, a history for versions linked to each other,
// a network for dependencies or calls, richtext / Format "markdown"|"code" for long text.

const MARKDOWN_NAMES = /(markdown|readme|body|content|bodyText|changelog|notes|description)$/i;
const CODE_NAMES = /(sourceCode|snippet|script|codeSnippet|codeBlock|sql|stylesheet|dockerfile|json|yaml)$/i;
// Lists of linked items that form a network rather than a hierarchy.
const LINK_NAMES = /^(dependencies|dependents|dependsOn|usedBy|uses|calls|callers|callees|invocations|imports|importedBy|references|referencedBy|links|edges|neighbou?rs|follows|followers|following)$/i;
const TEXT_SCALARS = /^(markdown|md|richtext|json|jsonobject|jsonstring|code|sourcecode|yaml)$/i;

/** Self-referencing fields: a list of the concept itself (children) or a single one (parent). */
function hierarchyHints(schema: ConceptSchemaInfo): string[] {
  const self = schema.fields.filter(
    (f) => !f.isScalar && f.typeName === schema.name && !LINK_NAMES.test(f.name) && !SUPERCLASS_FIELD_NAMES.test(f.name),
  );
  return self.map((f) =>
    f.isList
      ? `"${f.name}" lists more ${schema.name} (parent → children): show it with a "tree" widget, "childrenField": "${f.name}", selecting it 3-4 levels deep.`
      : `"${f.name}" points to the parent ${schema.name}: a "tree" widget over the list with "parentField": "${f.name}.id" builds the hierarchy.`,
  );
}

/** Relations of a related type to itself, e.g. `commits.parentCommits`: versions or nested items. */
function recursiveRelationHints(schema: ConceptSchemaInfo): string[] {
  return (schema.paths ?? [])
    .filter((p) => p.recursive && p.path.includes('.') && !p.path.split('.').some((s) => SUPERCLASS_FIELD_NAMES.test(s)))
    .map((p) => {
      const items = p.path.slice(0, p.path.lastIndexOf('.'));
      const link = p.path.slice(items.length + 1);
      return `"${p.path}" links ${p.typeName} items to each other: for versions (commits, revisions…) a "history" widget over "${items}" with "parentsField" or "childrenField": "${link}" (select "${link} { id }"); for nested items a "tree".`;
    });
}

/**
 * Superclass fields (superclass, extends, superInheritances…): a "classDiagram". Through an
 * association type (Inheritance { superclass }), the path to the concept is read from `paths`.
 */
function inheritanceHints(schema: ConceptSchemaInfo): string[] {
  return schema.fields
    .filter((f) => !f.isScalar && SUPERCLASS_FIELD_NAMES.test(f.name))
    .map((f) => {
      const through =
        f.typeName === schema.name
          ? undefined
          : (schema.paths ?? []).find((p) => p.typeName === schema.name && p.path.startsWith(`${f.name}.`) && p.path.split('.').length === 2);
      const superField = through?.path ?? (f.typeName === schema.name ? f.name : `${f.name}.<field holding the ${schema.name}>`);
      const [outer, inner] = superField.split('.');
      const nested = inner ? `${outer} { ${inner} { id name … } }` : `${outer} { id name … }`;
      return `"${f.name}" links each ${schema.name} to its superclass(es): an inheritance hierarchy, best shown as a "classDiagram" widget over the list with "superField": "${superField}" (select \`${nested}\`, nested again inside 6-8 levels to reach the root; add "attributesField"/"methodsField" when ${schema.name} lists them).`;
    });
}

/** Lists of linked items (dependencies, calls…): a network of nodes and arrows. */
function networkHints(schema: ConceptSchemaInfo): string[] {
  return schema.fields
    .filter((f) => !f.isScalar && f.isList && LINK_NAMES.test(f.name))
    .map(
      (f) =>
        `"${f.name}" links ${schema.name} items to ${f.typeName} items: a "network" widget over the list with "linksField": "${f.name}" (select "${f.name} { id … }", nested again inside to follow the links several levels deep; set "groupField" and "linkToByGroup" when the two types differ).`,
    );
}

function textHints(schema: ConceptSchemaInfo): string[] {
  return schema.fields
    .filter((f) => f.isScalar && !f.isList)
    .flatMap((f) => {
      const desc = f.description ?? '';
      if (TEXT_SCALARS.test(f.typeName) || CODE_NAMES.test(f.name) || /source code|code snippet/i.test(desc)) {
        return [`"${f.name}" holds code: a "code" widget (or Format "code" in a table); add "compare"/"annotations" when the API has another version or findings about it.`];
      }
      if (f.typeName === 'String' && (MARKDOWN_NAMES.test(f.name) || /markdown/i.test(desc))) {
        return [`"${f.name}" holds long text, likely Markdown: a "richtext" widget with "format": "markdown".`];
      }
      return [];
    });
}

/** Structure hints for the prompt, or null when the concept has nothing special. */
export function renderStructureHints(schema: ConceptSchemaInfo): string | null {
  const hints = [
    ...hierarchyHints(schema),
    ...recursiveRelationHints(schema),
    ...inheritanceHints(schema),
    ...networkHints(schema),
    ...textHints(schema),
  ];
  return hints.length ? ['Structure hints:', ...hints.map((h) => `  - ${h}`)].join('\n') : null;
}
