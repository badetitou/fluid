import { describe, expect, it } from 'vitest';
import {
  blueprintExample,
  safeParseWidgetDraft,
  widgetSchema,
  type BlueprintWidget,
} from '@fluid/shared';
import { blueprintProblem, buildBlueprint, MAX_METHODS, relatedKeys } from './blueprintModel';
import { orderedCollection } from './blueprintFixture';

const spec = blueprintExample.widgets[0] as BlueprintWidget;
const blueprint = buildBlueprint({ ...orderedCollection }, spec);
const method = (label: string) => blueprint.methods.find((m) => m.label === label)!;

describe('buildBlueprint', () => {
  it('puts each method in its layer, as the Moose class blueprint', () => {
    const layers = Object.fromEntries(blueprint.methods.map((m) => [m.label, m.layer]));
    expect(layers).toEqual({
      initialize: 'initialization',
      'add:': 'external',
      // called internally by add:, but also from another class
      'addLast:': 'external',
      removeFirst: 'external',
      makeRoomAtLast: 'internal',
      emptyCheck: 'internal',
      growAtLast: 'internal',
      firstIndex: 'accessor',
      isEmpty: 'external',
    });
  });

  it('colors methods by kind and orders the internal ones by call depth', () => {
    expect(method('isEmpty').kind).toBe('abstract');
    expect(method('emptyCheck').kind).toBe('overriding');
    expect(method('initialize').kind).toBe('constructor');
    expect(method('firstIndex').kind).toBe('accessor');
    expect(method('add:').kind).toBe('plain');
    expect([
      method('makeRoomAtLast').depth,
      method('growAtLast').depth,
      method('emptyCheck').depth,
    ]).toEqual([1, 2, 1]);
    expect(method('add:').depth).toBe(0);
  });

  it('keeps the calls and accesses within the class, keyed apart from each other', () => {
    expect(method('addLast:').calls).toEqual(['m:2:5']);
    expect(method('addLast:').accesses).toEqual(['a:3:3', 'a:3:2']);
    expect(blueprint.attributes.map((a) => a.key)).toEqual(['a:3:1', 'a:3:2', 'a:3:3']);
  });

  it('follows the flags when given, and private methods are internal', () => {
    const flagged = buildBlueprint(
      {
        methods: [
          { id: 1, name: 'build', ctor: true, open: true },
          { id: 2, name: 'initializeCache', ctor: false, open: false },
          { id: 3, name: 'x', getter: true, open: true },
        ],
      },
      {
        methodsField: 'methods',
        isConstructorField: 'ctor',
        isPublicField: 'open',
        isAccessorField: 'getter',
      },
    );
    expect(flagged.methods.map((m) => m.layer)).toEqual(['initialization', 'internal', 'accessor']);
  });

  it('reads the class from a list, labels by name then selector', () => {
    const fromList = buildBlueprint([{ methods: [{ id: 1, selector: 'foo' }] }], {
      methodsField: 'methods',
    });
    expect(fromList.methods[0].label).toBe('foo');
  });
});

describe('blueprintProblem', () => {
  it('explains an empty or oversized blueprint', () => {
    const opts = { methodsField: 'methods' };
    expect(blueprintProblem(null, buildBlueprint(null, opts), opts)).toMatch(/No class/);
    expect(blueprintProblem({ name: 'A' }, buildBlueprint({ name: 'A' }, opts), opts)).toMatch(
      /No methods: "methods"/,
    );
    const anonymous = { methods: [{ name: 'a' }] };
    expect(blueprintProblem(anonymous, buildBlueprint(anonymous, opts), opts)).toMatch(
      /No method has an id/,
    );
    const huge = {
      methods: Array.from({ length: MAX_METHODS + 1 }, (_, i) => ({ id: i, name: `m${i}` })),
    };
    expect(blueprintProblem(huge, buildBlueprint(huge, opts), opts)).toMatch(
      /Too many methods \(301/,
    );
    expect(blueprintProblem(orderedCollection, blueprint, spec)).toBeNull();
  });
});

describe('relatedKeys', () => {
  it('highlights a method with its calls, accesses and callers; an attribute with its accessors', () => {
    expect([...relatedKeys(blueprint, 'm:2:5')].sort()).toEqual(['m:2:3', 'm:2:5', 'm:2:7']);
    expect([...relatedKeys(blueprint, 'a:3:1')].sort()).toEqual([
      'a:3:1',
      'm:2:1',
      'm:2:4',
      'm:2:8',
    ]);
  });
});

describe('blueprint schema', () => {
  it('rejects a blueprint without its methods, generated or not', () => {
    const { methodsField: _methods, ...bare } = spec;
    const { id: _id, ...draft } = bare;
    expect(widgetSchema.safeParse(spec).success).toBe(true);
    expect(widgetSchema.safeParse(bare).success).toBe(false);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, methodsField: 'methods' }).success).toBe(true);
  });
});
