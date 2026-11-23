import { describe, expect, it } from 'vitest';
import { DECORATOR_LANGUAGE_DOC, renderDecoratorDocs } from './docs';
import { decoratorSpecSchema } from './schema';

describe('decorator docs', () => {
  it('renders nothing for no decorator', () => {
    expect(renderDecoratorDocs([])).toBe('');
  });

  it('lists tags, derived edges and constraints', () => {
    const spec = decoratorSpecSchema.parse({
      id: 'arch',
      label: 'Architecture',
      concepts: [
        { id: 'a', tag: 'ui' },
        { id: 'b', tagFrom: { field: 'file', pattern: '^(\\w+)/', prefix: 'svc:' } },
      ],
      derived: [
        { id: 'h', kind: 'http', from: {}, to: {}, join: { from: 'props.u', to: 'props.r' } },
      ],
      constraints: [{ id: 'big', check: 'node', severity: 'info', message: 'too big', match: {} }],
    });
    const text = renderDecoratorDocs([spec]);
    expect(text).toContain('"arch" — Architecture');
    expect(text).toContain('tags: ui, svc:<file>');
    expect(text).toContain('derived edges: http');
    expect(text).toContain('- big (info, node): too big');
  });

  it('documents the structural selector fields', () => {
    for (const field of ['"has"', '"in"', '"parent"', '"ancestor"', '"max": 0', '"child"']) {
      expect(DECORATOR_LANGUAGE_DOC).toContain(field);
    }
  });

  it('mentions all four checks in the language doc', () => {
    for (const check of ['node', 'forbidden', 'required', 'noCycle']) {
      expect(DECORATOR_LANGUAGE_DOC).toContain(`"check": "${check}"`);
    }
  });
});
