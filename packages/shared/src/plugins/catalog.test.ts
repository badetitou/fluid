import { describe, it, expect } from 'vitest';
import { todoListExample } from '../widgets/form';
import { checkActionReferences } from './catalog';
import { BUILTIN_WIDGET_CONTRACTS } from './contracts';

const contracts = Object.values(BUILTIN_WIDGET_CONTRACTS);

describe('checkActionReferences', () => {
  it('accepts widgets naming declared actions', () => {
    expect(checkActionReferences(todoListExample.widgets, todoListExample.actions, contracts)).toEqual([]);
  });

  it('reports the action keys a form or row action names but the view lacks', () => {
    const widgets = [
      { id: 'f', type: 'form', action: 'save' },
      { id: 't', type: 'table', data: { query: 'q' }, rowActions: [{ action: 'remove' }, { action: 'done' }] },
      { id: 'a', type: 'accordion', data: { query: 'q' }, widgets: [{ id: 'g', type: 'form', action: 'add' }] },
    ];
    expect(checkActionReferences(widgets, { done: {} }, contracts)).toEqual([
      'widgets.0.action: "save" is not an action of the view (declare it in "actions")',
      'widgets.1.rowActions: "remove" is not an action of the view (declare it in "actions")',
      'widgets.2.widgets.0.action: "add" is not an action of the view (declare it in "actions")',
    ]);
  });

  it('only reads the action slots the contract declares', () => {
    expect(checkActionReferences([{ id: 's', type: 'statistic', action: 'x' }], undefined, contracts)).toEqual([]);
  });
});
