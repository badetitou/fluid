import type { FormatKind } from '@fluid/shared';
import type { ConceptField } from '../graphql/introspection';

// Heuristics shared by the auto-generated views: labels, formats and the field
// that best names an item.

export function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// String fields whose name suggests a picture URL.
const IMAGEISH = /(image|avatar|portrait|photo|picture|thumbnail|logo)(url)?$/i;

export function guessFormat(field: ConceptField): FormatKind | undefined {
  if (field.typeKind === 'ENUM') return 'tag';
  if (field.typeName === 'String' && IMAGEISH.test(field.name)) return 'image';
  switch (field.typeName) {
    case 'DateTime':
      return 'datetime';
    case 'Boolean':
      return 'boolean';
    case 'Float':
    case 'Int':
      return 'number';
    default:
      return undefined;
  }
}

// Human-friendly fields, in order of preference, to label an entity.
const LABELISH = ['name', 'title', 'label', 'fullName', 'displayName', 'email', 'reference', 'iban'];

/** The field that best names an entity: a label-ish scalar, else the first non-id one. */
export function pickLabelField(scalars: ConceptField[]): ConceptField {
  return (
    scalars.find((f) => LABELISH.includes(f.name)) ??
    scalars.find((f) => f.name !== 'id') ??
    scalars[0]
  );
}

/** How a long text property is best shown in full: Markdown or source code. */
export type TextKind = 'markdown' | 'code';

// Custom scalars and field names that announce Markdown or code. Plain `code`
// is left out on purpose: it is usually a short identifier (country code…).
const MARKDOWN_SCALARS = /^(markdown|md|richtext)$/i;
const CODE_SCALARS = /^(json|jsonobject|jsonstring|code|sourcecode|yaml)$/i;
const MARKDOWN_NAMES = /(markdown|readme|body|content|bodyText|changelog|notes)$/i;
const CODE_NAMES = /(sourceCode|snippet|script|codeSnippet|codeBlock|sql|stylesheet|dockerfile|json|yaml)$/i;

/** Whether a String-like scalar holds Markdown or code, from its type, name and description. */
export function textKindOf(field: ConceptField): TextKind | undefined {
  if (!field.isScalar || field.isList) return undefined;
  if (MARKDOWN_SCALARS.test(field.typeName)) return 'markdown';
  if (CODE_SCALARS.test(field.typeName)) return 'code';
  if (field.typeName !== 'String') return undefined;
  if (/\bmarkdown\b/i.test(field.description ?? '')) return 'markdown';
  if (/\b(source code|code snippet)\b/i.test(field.description ?? '')) return 'code';
  if (CODE_NAMES.test(field.name)) return 'code';
  if (MARKDOWN_NAMES.test(field.name)) return 'markdown';
  return undefined;
}

/** Code language implied by a field, when its type or name tells it. */
export function codeLanguageOf(field: ConceptField): string | undefined {
  const hint = `${field.typeName} ${field.name}`.toLowerCase();
  return ['json', 'yaml', 'sql', 'graphql', 'python', 'css'].find((lang) => hint.includes(lang));
}
