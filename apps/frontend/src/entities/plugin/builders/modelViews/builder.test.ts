import { describe, expect, it } from 'vitest';
import { buildSchema, parse, validate } from 'graphql';
import { BUILTIN_WIDGET_CONTRACTS, viewSpecSchema, type ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../../../graphql/introspection';
import type { ViewBuilderContext } from '../../viewBuilder';
import { MODEL_QUERIES } from './fixtures';
import MODEL_SCHEMA from './model-schema.graphql?raw';
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
    const [tree] = modelPerspectives(context('Namespace', 'list'));
    expect(tree).toMatchObject({ origin: 'curated', defaultFor: 'list', title: 'Code tree' });
    expect(widget(tree.spec, 'tree')).toMatchObject({ type: 'tree', keyField: 'key', childrenField: 'children.nodes', linkTo: { concept: 'Entity', idField: 'key' } });
    expect(tree.spec.queries.model.query).toContain('entities(roots: true, external: false');
    expect(modelPerspectives(context('Namespace', 'detail')).map((p) => p.title)).toEqual(['Contents']);
    expect(modelPerspectives(context('Method', 'list'))).toEqual([]);
  });

  it('shows a class with its methods, fields and inheritance', () => {
    const [overview, contents] = specsOf(context('Class', 'detail'));
    expect(overview.queries.type.query).toMatch(/classByKey\(key: \$id\)/);
    expect(overview.queries.type.query).toMatch(/\$id: String!/);
    expect(overview.queries.type.query).toContain('supertypes: outgoing(kind: "inherits"');
    expect(widget(overview, 'methods')).toMatchObject({ type: 'table', data: { path: 'classByKey.methods.nodes' } });
    expect(widget(overview, 'fields')).toMatchObject({ type: 'table', data: { path: 'classByKey.fields.nodes' } });
    expect(widget(overview, 'hierarchy')).toMatchObject({ incomingField: 'subtypes.nodes.from', outgoingField: 'supertypes.nodes.to', idField: 'key' });
    expect(contents.title).toBe('Contents');
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
      ...specsOf(context('Class', 'detail')),
      ...specsOf(context('Interface', 'detail')),
      ...specsOf(context('Method', 'detail')),
      ...specsOf(context('Function', 'detail')),
      ...specsOf(context('File', 'detail')),
    ];
    for (const spec of specs) {
      expect(viewSpecSchema.safeParse(spec).error).toBeUndefined();
      for (const w of spec.widgets) expect(BUILTIN_WIDGET_CONTRACTS).toHaveProperty(w.type);
      for (const q of Object.values(spec.queries)) expect(validate(schema, parse(q.query)).map((e) => e.message)).toEqual([]);
    }
  });
});
