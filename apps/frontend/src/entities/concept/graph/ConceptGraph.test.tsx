import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Concept, ConceptField } from '../../../graphql/introspectionTypes';
import { ConceptGraph } from './ConceptGraph';

const field = (name: string, typeName: string, isScalar: boolean, isList = false): ConceptField => ({
  name,
  description: null,
  typeName,
  typeKind: isScalar ? 'SCALAR' : 'OBJECT',
  isList,
  isScalar,
});

const fields = [field('name', 'String', true), field('origin', 'Location', false), field('episode', 'Episode', false, true)];
const character: Concept = {
  name: 'Character',
  description: null,
  fields,
  scalarFields: fields.filter((f) => f.isScalar),
  relationFields: fields.filter((f) => !f.isScalar),
  queries: {},
};

afterEach(cleanup);

describe('ConceptGraph', () => {
  it('walks into a relation and picks a property', () => {
    const onEnter = vi.fn();
    const onPick = vi.fn();
    render(<ConceptGraph concept={character} filter="" onEnter={onEnter} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to episode (Episode)' }));
    expect(onEnter).toHaveBeenCalledWith('episode');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Pick name' }), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('name');
  });

  it('shows the picked property as pressed', () => {
    render(<ConceptGraph concept={character} filter="" picked="name" onEnter={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pick name' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('leaves properties inert when they cannot be picked', () => {
    render(<ConceptGraph concept={character} filter="" onEnter={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pick name' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
