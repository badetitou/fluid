import { describe, expect, it } from 'vitest';
import { buildSchema, parse, validate, type GraphQLSchema } from 'graphql';
import { BUILTIN_WIDGET_CONTRACTS, viewSpecSchema, type ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../../../graphql/introspection';
import type { ViewBuilderContext } from '../../viewBuilder';
import { MODEL_QUERIES } from './fixtures';
import MODEL_SCHEMA from './model-schema.graphql?raw';
import PYTHON_SCHEMA from './model-schema-python.graphql?raw';
import { TREE_PAGE } from './selections';
import { modelPerspectives } from '.';

const context = (name: string, columnKind: 'list' | 'detail', queriesByType: Map<string, ConceptQueries> = MODEL_QUERIES): ViewBuilderContext => ({
  concept: { name, interfaces: ['Entity'] } as Concept,
  columnKind,
  itemId: columnKind === 'detail' ? 'model python . . requests/`sessions.py`/Session#' : undefined,
  conceptByName: new Map(),
  queriesByType,
  writable: false,
  settings: {},
});

const specsOf = (ctx: ViewBuilderContext): ViewSpec[] => modelPerspectives(ctx).map((p) => p.spec);
const widget = (spec: ViewSpec, id: string) => spec.widgets.find((w) => w.id === id) as Record<string, unknown>;

describe('Model views builder', () => {
  it('proposes nothing on a source that is not Model', () => {
    expect(modelPerspectives(context('Class', 'detail', new Map()))).toEqual([]);
    expect(modelPerspectives(context('Namespace', 'list', new Map()))).toEqual([]);
  });

  it('proposes the code tree on namespace lists, a contents view on namespace details', () => {
    const [tree, packages, flows] = modelPerspectives(context('Namespace', 'list'));
    expect(tree).toMatchObject({ origin: 'curated', defaultFor: 'list', title: 'Code tree' });
    expect(packages.title).toBe('Package dependencies');
    expect(flows.title).toBe('Architecture flows');
    expect(widget(tree.spec, 'tree')).toMatchObject({ type: 'tree', keyField: 'key', childrenField: 'children.nodes', linkTo: { concept: 'Entity', idField: 'key' } });
    expect(tree.spec.queries.model.query).toContain('entities(roots: true, external: false');
    expect(modelPerspectives(context('Namespace', 'detail')).map((p) => p.title)).toEqual(['Contents']);
    expect(modelPerspectives(context('Method', 'list'))).toEqual([]);
  });

  it('shows a class with its methods, fields and inheritance', () => {
    const [overview, , contents] = specsOf(context('Class', 'detail'));
    expect(overview.queries.type.query).toMatch(/classByKey\(key: \$id\)/);
    expect(overview.queries.type.query).toMatch(/\$id: String!/);
    expect(overview.queries.type.query).toContain('supertypes: outgoing(kind: "inherits"');
    expect(widget(overview, 'methods')).toMatchObject({ type: 'table', data: { path: 'classByKey.methods.nodes' } });
    expect(widget(overview, 'fields')).toMatchObject({ type: 'table', data: { path: 'classByKey.fields.nodes' } });
    expect(widget(overview, 'hierarchy')).toMatchObject({ incomingField: 'subtypes.nodes.from', outgoingField: 'supertypes.nodes.to', idField: 'key' });
    expect(contents.title).toBe('Contents');
  });

  it('shows a blueprint of a type, from its calls and references to fields', () => {
    const specs = specsOf(context('Class', 'detail'));
    const blueprint = specs[1];
    expect(blueprint.title).toBe('Blueprint');
    expect(blueprint.queries.entity.query).toContain('classByKey(key: $id)');
    expect(blueprint.queries.entity.query).toContain('calls: outgoing(kind: "calls"');
    expect(blueprint.queries.entity.query).toContain('callers: incoming(kind: "calls"');
    expect(blueprint.queries.entity.query).toContain('accesses: outgoing(kind: "references"');
    expect(blueprint.queries.entity.query).toContain('attributes: children(kind: FIELD');
    expect(widget(blueprint, 'blueprint')).toMatchObject({
      type: 'blueprint',
      methodsField: 'methods',
      attributesField: 'attributes.nodes',
      idField: 'key',
      callsField: 'calls.nodes.to.key',
      callersField: 'callers.nodes.from.key',
      accessesField: 'accesses.nodes.to.key',
      linkTo: { concept: 'Entity', idField: 'key' },
    });
    expect(specs[2].title).toBe('Contents');
  });

  it('proposes a polymetric map of classes on class lists', () => {
    const perspectives = modelPerspectives(context('Class', 'list'));
    expect(perspectives.map((p) => p.title)).toEqual(['System complexity', 'Dependency matrix']);
    const spec = perspectives[0].spec;
    expect(spec.queries.classes.query).toContain('classes(first:');
    expect(spec.queries.classes.query).toContain('methods: children(kind: METHOD, first: 0)');
    for (const counter of ['callees', 'references', 'subclasses'])
      expect(spec.queries.classes.query).toContain(`${counter}: `);
    expect(widget(spec, 'complexity')).toMatchObject({
      type: 'boxes',
      boxLayout: 'tree',
      widthField: 'fields.totalCount',
      heightField: 'methods.totalCount',
      sizeField: 'methods.totalCount',
      colorField: 'callers.totalCount',
      groupField: 'parent.name',
      parentField: 'supertypes.nodes.to.key',
    });
  });

  it('builds dependency matrices of calls and references between classes', () => {
    const spec = modelPerspectives(context('Class', 'list'))[1].spec;
    expect(spec.queries.model.query).toContain('classes(first: 300)');
    expect(spec.queries.model.query).toContain('calls: outgoing(kind: "calls"');
    expect(spec.widgets.map((w) => w.id)).toEqual(['calls', 'references']);
    expect(widget(spec, 'calls')).toMatchObject({
      type: 'matrix',
      columns: 'same',
      targetsField: 'calls.nodes.to',
      targetIdField: 'key',
      groupField: 'parent.name',
    });
    expect(widget(spec, 'references')).toMatchObject({ targetsField: 'references.nodes.to' });
  });

  it('builds a package DSM from the calls between the classes of each namespace', () => {
    const spec = modelPerspectives(context('Namespace', 'list'))[1].spec;
    expect(spec.queries.model.query).toContain('namespaces(first: 300)');
    expect(spec.queries.model.query).toContain('classes: children(kind: CLASS');
    expect(widget(spec, 'calls')).toMatchObject({
      type: 'matrix',
      targetsField: 'classes.nodes.calls.nodes.to.parent',
      targetIdField: 'key',
      columns: 'same',
    });
  });

  it('folds calls into layered flows between packages', () => {
    const spec = modelPerspectives(context('Namespace', 'list'))[2].spec;
    expect(spec.title).toBe('Architecture flows');
    expect(spec.queries.model.query).toContain('classes(first: 300)');
    expect(spec.queries.model.query).toContain('calls: outgoing(kind: "calls"');
    expect(widget(spec, 'flows')).toMatchObject({
      type: 'sankey',
      data: { query: 'model', path: 'classes.nodes' },
      groupField: 'parent.name',
      targetsField: 'calls.nodes.to',
      targetGroupField: 'parent.name',
      columns: expect.arrayContaining([expect.arrayContaining(['*persistence*'])]),
    });
  });

  it('shows the callers and callees of a method, with their site counts', () => {
    const [calls] = modelPerspectives(context('Method', 'detail'));
    expect(calls.defaultFor).toBe('detail');
    expect(calls.spec.queries.callable.query).toContain('callers: incoming(kind: "calls"');
    expect(widget(calls.spec, 'calls')).toMatchObject({ type: 'butterfly', incomingField: 'callers.nodes.from', outgoingField: 'callees.nodes.to' });
    const callees = widget(calls.spec, 'callees') as { columns: { key: string }[] };
    expect(callees.columns.map((c) => c.key)).toContain('siteCount');
    expect(specsOf(context('Function', 'detail'))[0].queries.callable.query).toContain('functionByKey(key: $id)');
  });

  it('bounds the trees: two levels, a page per level, counts beyond it', () => {
    const query = specsOf(context('Namespace', 'list'))[0].queries.model.query;
    expect(query.match(/children\(first: (\d+)\)/g)).toEqual([`children(first: ${TREE_PAGE})`, `children(first: ${TREE_PAGE})`, 'children(first: 0)']);
    const [contents] = specsOf(context('Namespace', 'detail'));
    expect(contents.queries.entity.query.match(/children\(first: \d+\)/g)).toHaveLength(3);
    expect(widget(contents, 'tree')).toMatchObject({ columns: expect.arrayContaining([{ key: 'children.totalCount', title: 'Contains', format: 'number' }]) });
  });

  it('builds valid specs, from catalog widgets only, with queries valid against the Model schema', () => {
    const schema = buildSchema(MODEL_SCHEMA);
    const specs = [
      ...specsOf(context('Namespace', 'list')),
      ...specsOf(context('Namespace', 'detail')),
      ...specsOf(context('Class', 'list')),
      ...specsOf(context('Class', 'detail')),
      ...specsOf(context('Interface', 'detail')),
      ...specsOf(context('Method', 'detail')),
      ...specsOf(context('Function', 'detail')),
      ...specsOf(context('File', 'detail')),
    ];
    expectValid(schema, specs);
  });

  it('treats the finer concepts of Model 0.4.0 by archetype: records and annotation types as types', () => {
    for (const [concept, lookup] of [['Record', 'recordByKey'], ['AnnotationType', 'annotationTypeByKey']]) {
      const [overview, , contents] = specsOf(context(concept, 'detail'));
      expect(overview.title).toBe(`${concept} overview`);
      expect(overview.queries.type.query).toContain(`${lookup}(key: $id)`);
      expect(contents.title).toBe('Contents');
    }
    expectValid(buildSchema(MODEL_SCHEMA), [...specsOf(context('Record', 'detail')), ...specsOf(context('AnnotationType', 'detail'))]);
  });

  it('treats Python modules as containers, valid against a Python model schema', () => {
    const lists = modelPerspectives(context('PythonModule', 'list'));
    expect(lists.map((p) => p.title)).toEqual(['Code tree']);
    const [contents] = specsOf(context('PythonModule', 'detail'));
    expect(contents.title).toBe('Contents');
    expect(contents.queries.entity.query).toContain('pythonModuleByKey(key: $id)');
    expectValid(buildSchema(PYTHON_SCHEMA), [...lists.map((p) => p.spec), contents]);
  });
});

function expectValid(schema: GraphQLSchema, specs: ViewSpec[]): void {
  for (const spec of specs) {
    expect(viewSpecSchema.safeParse(spec).error).toBeUndefined();
    for (const w of spec.widgets) expect(BUILTIN_WIDGET_CONTRACTS).toHaveProperty(w.type);
    for (const q of Object.values(spec.queries)) expect(validate(schema, parse(q.query)).map((e) => e.message)).toEqual([]);
  }
}
