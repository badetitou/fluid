import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { dataBindingSchema, linkToSchema, widgetBase } from './common';

/**
 * A UML class diagram of an inheritance hierarchy: superclasses on top, their
 * subclasses below, joined by inheritance arrows (hollow triangle towards the
 * superclass). Each class is a three-compartment box (name, attributes,
 * methods). Branches fold and unfold; several roots make a forest; with
 * multiple inheritance a class sits under its first superclass and names the
 * others ("extends B, C"). Clicking a class name selects it (emitted on
 * `selected`) and opens it in a new column.
 *
 * Classes are the bound rows. Their superclasses (`superField`) are followed at
 * any depth: a superclass object selecting its own superclasses adds them too,
 * and superclasses missing from the rows become classes of the diagram.
 */
export const classDiagramWidgetSchema = z.object({
  type: z.literal('classDiagram'),
  ...widgetBase,
  /** The classes. */
  data: dataBindingSchema,
  /** Dot path of a class's id, unique across the classes (default "id"); also read in superclass objects. */
  idField: z.string().min(1).optional(),
  /** Dot path of a class's name (default: name, title, label… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /**
   * Dot path of a class's superclass(es): an id, an object holding it, or a list of them, possibly
   * through association objects ("superInheritances.superclass"). Required: it is the hierarchy.
   */
  superField: z.string().min(1),
  /** Dot path of a class's attributes: a list of strings or of objects (default: no attribute compartment content). */
  attributesField: z.string().min(1).optional(),
  /** Dot path of a class's methods: a list of strings or of objects. */
  methodsField: z.string().min(1).optional(),
  /** Dot path of the label of an attribute or method object (default: name, title, label…). */
  memberLabelField: z.string().min(1).optional(),
  /** Dot path of a boolean: the class is abstract (name in italics, «abstract»). */
  abstractField: z.string().min(1).optional(),
  /** Dot path of the class's package or module (e.g. "parentPackage.name"): shown small, and colors the box. */
  groupField: z.string().min(1).optional(),
  /** Attributes and methods listed per compartment before "+N more" (default 6; 0 hides members). */
  maxMembers: z.number().int().min(0).max(50).optional(),
  /** Levels of the hierarchy unfolded at first (default 2: the roots and their subclasses show theirs). */
  expandDepth: z.number().int().min(0).max(20).optional(),
  /** Opens the clicked class in a new column. */
  linkTo: linkToSchema.optional(),
});
export type ClassDiagramWidget = z.infer<typeof classDiagramWidgetSchema>;

/**
 * Names of the fields linking a class to its superclass(es), directly or
 * through association objects (superclass, extends, superInheritances…).
 */
export const SUPERCLASS_FIELD_NAMES =
  /^(super_?class(es)?|super_?types?|super_?inheritances?|super_?interfaces?|extends|parent_?class(es)?|base_?class(es)?|inherits_?from)$/i;

/** How the LLM is told to use the class diagram widget. */
export const classDiagramWidgetDoc = `- { "id": string, "type": "classDiagram", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: ... }, "superField": string, "idField"?: string, "labelField"?: string,
    "attributesField"?: string, "methodsField"?: string, "memberLabelField"?: string, "abstractField"?: string,
    "groupField"?: string, "maxMembers"?: number, "expandDepth"?: number, "linkTo"?: LinkConfig }
    Use it for an INHERITANCE HIERARCHY drawn as a UML class diagram: classes and their superclasses,
    interfaces they extend, types and their subtypes, exception hierarchies… Superclasses on top, subclasses
    below, UML inheritance arrows; each class is a box listing its attributes and methods; branches fold.
    Prefer it to "network" whenever the links are "is a kind of" (superclass, extends, parentClass,
    superInheritances); keep "network" for dependencies and calls, "tree" for containment (folders, packages).
    The bound rows are the CLASSES. "superField" (required) points to each class's superclass(es): an id,
    an object holding it (\`superclass { id name }\` → "superclass"), or a list; through association objects
    use a dot path (\`superInheritances { superclass { id name } }\` → "superInheritances.superclass").
    Superclasses are FOLLOWED AT ANY DEPTH and added as classes: to reach the root (e.g. Object), nest the
    superclass selection again inside itself 6-8 levels, with the same fields at every level (a GraphQL
    fragment helps: \`superclass { ...C superInheritances { superclass { ...C … } } }\`).
    "attributesField"/"methodsField": lists of strings or objects (label read with "memberLabelField",
    default name), e.g. "attributes", "methods"; "maxMembers" (default 6) caps each compartment.
    "abstractField": a boolean (e.g. "isAbstract"); "groupField": the package (e.g. "parentPackage.name").
    "expandDepth": levels unfolded at first (default 2; 1 for hundreds of classes). Set "linkTo" (the
    class concept) whenever classes have an id. Clicking a class name emits its row on "selected" (bind a
    "descriptions" to \`{ "query": "@<id>", "path": "selected" }\` for a master/detail view).`;

const classFields = /* GraphQL */ `fragment ClassBox on Class {
  id
  name
  isAbstract
  parentPackage {
    name
  }
}`;

/** `superInheritances { superclass { ...ClassBox … } }`, nested `levels` times. */
function superclasses(levels: number): string {
  if (levels === 0) return '';
  return `superInheritances { superclass { ...ClassBox ${superclasses(levels - 1)} } }`;
}

/**
 * A curated view for code-analysis APIs exposing a `Class` concept with its
 * superclasses through `Inheritance` objects (Moose / a Pharo image): the
 * inheritance hierarchy as a UML class diagram. No public API ships one: it
 * serves as a reference.
 */
export const classDiagramExample: ViewSpec = {
  version: 1,
  id: 'builtin:class-diagram',
  concept: 'Class',
  scope: 'list',
  title: 'Class diagram',
  description: 'The inheritance hierarchy of the classes, as a UML class diagram.',
  queries: {
    classes: {
      query: /* GraphQL */ `
        query FluidClassDiagram($take: Int) {
          classes(take: $take) {
            ...ClassBox
            numberOfMethods
            attributes {
              id
              name
            }
            methods {
              id
              name
            }
            ${superclasses(7)}
          }
        }
        ${classFields}
      `,
      variables: { take: 200 },
    },
  },
  widgets: [
    {
      id: 'hierarchy',
      type: 'classDiagram',
      title: 'Inheritance',
      span: 18,
      height: 640,
      data: { query: 'classes', path: 'classes' },
      superField: 'superInheritances.superclass',
      attributesField: 'attributes',
      methodsField: 'methods',
      abstractField: 'isAbstract',
      groupField: 'parentPackage.name',
      expandDepth: 2,
      linkTo: { concept: 'Class', idField: 'id' },
    },
    {
      id: 'selection',
      type: 'descriptions',
      title: 'Selected class',
      span: 6,
      data: { query: '@hierarchy', path: 'selected' },
      columns: 1,
      items: [
        { label: 'Name', key: 'name' },
        { label: 'Package', key: 'parentPackage.name', format: 'tag' },
        { label: 'Abstract', key: 'isAbstract', format: 'boolean' },
        { label: 'Methods', key: 'numberOfMethods', format: 'number' },
      ],
    },
  ],
};
