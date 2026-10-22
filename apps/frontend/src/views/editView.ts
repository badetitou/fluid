import type { ActionSpec, ViewSpec, Widget } from '@fluid/shared';
import { keyFieldOf, type Concept } from '../graphql/introspection';

/** Key of the action and id of the form the auto detail view gets. */
export const AUTO_EDIT_ACTION = 'update';

/**
 * The action updating one item of the concept with its `update` mutation:
 * `$target.<key>` as the item, the form as its input object. Null when that
 * mutation cannot be called this way (no key or input argument, another
 * required argument, a type hidden by a shallow introspection, or an answer
 * that is not the item itself, whose fields Fluid could not select).
 */
export function buildUpdateAction(concept: Concept): ActionSpec | null {
  const update = concept.mutations?.update;
  if (!update?.idArg || !update.inputArg || !update.returnsConcept) return null;
  const used = new Set([update.idArg, update.inputArg]);
  if (update.args.some((a) => (a.required && !used.has(a.name)) || (used.has(a.name) && !a.type))) return null;

  const declared = update.args.filter((a) => used.has(a.name));
  const variables = declared.map((a) => `$${a.name}: ${a.type}`).join(', ');
  const args = declared.map((a) => `${a.name}: $${a.name}`).join(', ');
  const selection = concept.scalarFields.filter((f) => !f.hasRequiredArgs).map((f) => f.name).join(' ');
  return {
    mutation: `mutation FluidAutoUpdate_${concept.name}(${variables}) { ${update.field}(${args}) { ${selection} } }`,
    variables: { [update.idArg]: `$target.${keyFieldOf(concept.queries)}`, [update.inputArg]: '$form' },
    label: 'Save',
  };
}

/**
 * The auto detail view with an "Edit" form when the concept can be updated:
 * its fields come from the mutation's input type, it starts from the item shown.
 */
export function withEditForm(spec: ViewSpec, concept: Concept): ViewSpec {
  const byIdField = concept.queries.byId?.field;
  const action = buildUpdateAction(concept);
  if (!byIdField || !action) return spec;
  const form: Widget = {
    id: 'edit',
    type: 'form',
    title: 'Edit',
    span: 24,
    data: { query: byIdField, path: byIdField },
    action: AUTO_EDIT_ACTION,
  };
  return { ...spec, actions: { ...spec.actions, [AUTO_EDIT_ACTION]: action }, widgets: [...spec.widgets, form] };
}
