import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { dataBindingSchema, linkToSchema, widgetBase } from './common';

const path = () => z.string().min(1);

/**
 * The Class Blueprint (Lanza & Ducasse, Moose `CBView`): the inner structure of
 * ONE class in five columns, left to right: Initialization, External interface,
 * Internal implementation (split by call depth), Accessors, Attributes. Each
 * method is a small box (height = its size, color = its kind: abstract,
 * overriding, accessor, constructor), with arrows for the calls between the
 * class's own methods and for the attributes they access. Hovering a method
 * highlights its calls and accesses; clicking a method or an attribute emits
 * its row on `selected` and opens it in a new column.
 *
 * The bound data is the class (an object; the first row of a list). Methods
 * and attributes are read from it; the links between them are ids.
 */
export const blueprintWidgetSchema = z.object({
  type: z.literal('blueprint'),
  ...widgetBase,
  /** The class: an object holding its methods and attributes. */
  data: dataBindingSchema,
  /** Dot path of the class's methods (e.g. "methods"). Required: they are the blueprint. */
  methodsField: path(),
  /** Dot path of the class's attributes (e.g. "attributes"; default: no attribute column content). */
  attributesField: path().optional(),
  /** Dot path of the id of a method or attribute, also read in linked objects (default "id"). */
  idField: path().optional(),
  /** Dot path of the label of a method or attribute (default: name, selector, title…). */
  labelField: path().optional(),
  /** Dot path, in a method, of the methods it calls: ids or objects holding them ("outgoingInvocations.candidates"). */
  callsField: path().optional(),
  /** Dot path, in a method, of the attributes it reads or writes: ids or objects ("accesses.variable"). */
  accessesField: path().optional(),
  /**
   * Dot path, in a method, of its callers ("incomingInvocations.sender"): a method called from outside the
   * class belongs to the external interface even when also called internally.
   */
  callersField: path().optional(),
  /** Dot path of a boolean: the method is a constructor (default: deduced, see the doc). */
  isConstructorField: path().optional(),
  /** Dot path of a boolean: the method is a getter or setter (default: deduced, see the doc). */
  isAccessorField: path().optional(),
  /** Dot path of a boolean: the method is public (default: every method is). */
  isPublicField: path().optional(),
  /** Dot path of a boolean: the method is abstract. */
  isAbstractField: path().optional(),
  /** Dot path of a boolean: the method overrides one of a superclass. */
  isOverridingField: path().optional(),
  /** Dot path of a method's size in lines (e.g. "linesOfCode"): the height of its box. */
  sizeField: path().optional(),
  /** Opens the clicked method in a new column. */
  linkTo: linkToSchema.optional(),
  /** Opens the clicked attribute in a new column. */
  attributeLinkTo: linkToSchema.optional(),
});
export type BlueprintWidget = z.infer<typeof blueprintWidgetSchema>;

/** How the LLM is told to use the class blueprint widget. */
export const blueprintWidgetDoc = `- { "id": string, "type": "blueprint", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: ... }, "methodsField": string, "attributesField"?: string, "idField"?: string,
    "labelField"?: string, "callsField"?: string, "accessesField"?: string, "callersField"?: string,
    "isConstructorField"?: string, "isAccessorField"?: string, "isPublicField"?: string, "isAbstractField"?: string,
    "isOverridingField"?: string, "sizeField"?: string, "linkTo"?: LinkConfig, "attributeLinkTo"?: LinkConfig }
    Use it ONLY in the DETAIL view of ONE CLASS (or module, component) whose query returns its methods and
    attributes WITH their links: it shows the class's inner structure (cohesion, layers, attribute accesses),
    as the Moose Class Blueprint. Five columns: Initialization (constructors), External interface (public
    methods called from outside or not called internally), Internal implementation (called by the class's own
    methods, by call depth), Accessors (getters/setters), Attributes; arrows for internal calls and attribute
    accesses. Not for a list of classes ("classDiagram", "network" or "table" there).
    "data" binds the CLASS object (e.g. \`{ "query": "class", "path": "class" }\`). "methodsField" (required)
    points to its methods, "attributesField" to its attributes, each with an id ("idField", default id) and a
    name ("labelField", default name/selector). In each method: "callsField" lists the methods it calls (ids
    or objects, e.g. "outgoingInvocations.candidates"), "accessesField" the attributes it reads/writes (e.g.
    "accesses.variable"), "callersField" its callers (e.g. "incomingInvocations.sender"); select their ids.
    Booleans "isConstructorField", "isAccessorField", "isPublicField", "isAbstractField", "isOverridingField";
    "sizeField" the lines of code (box height). Without them, constructors are methods named initialize*/
    init/new not called internally, accessors those accessing one attribute, calling nothing, ≤ 3 lines.
    Set "linkTo" (method concept) and "attributeLinkTo" (attribute concept) when they have ids. Clicking a
    method or attribute emits its row on "selected" (bind a "descriptions" or "code" to
    \`{ "query": "@<id>", "path": "selected" }\` for a master/detail view). Above 300 methods it shows a message.`;

/**
 * A curated view for code-analysis APIs exposing a `Class` concept with its
 * methods and attributes and the invocations and accesses between them (Moose
 * / a Pharo image): the class blueprint, the selected method's source beside.
 * No public API ships one: it serves as a reference.
 */
export const blueprintExample: ViewSpec = {
  version: 1,
  id: 'builtin:class-blueprint',
  concept: 'Class',
  scope: 'detail',
  title: 'Class blueprint',
  description:
    'The inner structure of the class: its methods by layer, their calls and attribute accesses.',
  queries: {
    class: {
      query: /* GraphQL */ `
        query FluidClassBlueprint($id: ID!) {
          class(id: $id) {
            id
            name
            attributes {
              id
              name
            }
            methods {
              id
              selector
              protocol
              linesOfCode
              isAbstract
              isOverriding
              sourceCode
              outgoingInvocations {
                candidates {
                  id
                }
              }
              incomingInvocations {
                sender {
                  id
                }
              }
              accesses {
                variable {
                  id
                }
              }
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'blueprint',
      type: 'blueprint',
      title: 'Blueprint',
      span: 16,
      height: 560,
      data: { query: 'class', path: 'class' },
      methodsField: 'methods',
      attributesField: 'attributes',
      labelField: 'selector',
      callsField: 'outgoingInvocations.candidates',
      callersField: 'incomingInvocations.sender',
      accessesField: 'accesses.variable',
      isAbstractField: 'isAbstract',
      isOverridingField: 'isOverriding',
      sizeField: 'linesOfCode',
      linkTo: { concept: 'Method', idField: 'id' },
      attributeLinkTo: { concept: 'Attribute', idField: 'id' },
    },
    {
      id: 'selection',
      type: 'descriptions',
      title: 'Selected',
      span: 8,
      data: { query: '@blueprint', path: 'selected' },
      columns: 1,
      items: [
        { label: 'Name', key: 'selector' },
        { label: 'Attribute', key: 'name' },
        { label: 'Protocol', key: 'protocol', format: 'tag' },
        { label: 'Lines', key: 'linesOfCode', format: 'number' },
        { label: 'Source', key: 'sourceCode', format: 'code' },
      ],
    },
  ],
};
