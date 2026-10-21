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
