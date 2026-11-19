import { describe, expect, it, vi } from 'vitest';
import { OPEN_VIEWS_QUERIES } from '@fluid/shared';
import type { DataSource } from '../../plugin-api/dataSources';
import { openViewSource } from './sourceModel';

const fakeSource = (answer: unknown) => {
  const run = vi.fn<DataSource['run']>(() => Promise.resolve(answer));
  return { source: { id: 'ov', run } satisfies DataSource, run };
};

describe('openViewSource', () => {
  const variables = { id: 'o1', view: 'methods' };

  it('pages items with the bound variables, path and offset', async () => {
    const { source, run } = fakeSource({ items: [{ cells: [{ text: 'a' }] }], total: 9 });
    const page = await openViewSource(source, 'view', variables).items('1.0', 5, 10);
    expect(page.total).toBe(9);
    expect(run).toHaveBeenCalledWith(OPEN_VIEWS_QUERIES.items, { id: 'o1', view: 'methods', path: '1.0', offset: 5, limit: 10 });
  });

  it('runs an action and the bound query again', async () => {
    const { source, run } = fakeSource({ refresh: true });
    const ov = openViewSource(source, 'view', variables);
    expect(await ov.action('rename')).toEqual({ refresh: true });
    expect(run).toHaveBeenLastCalledWith(OPEN_VIEWS_QUERIES.action, { id: 'o1', view: 'methods', action: 'rename' });
    await ov.reload();
    expect(run).toHaveBeenLastCalledWith('view', variables);
  });

  it('forwards to the view of another object on the same source', async () => {
    const { source, run } = fakeSource({ object: { id: 'c2' }, views: [] });
    const ov = openViewSource(source, 'view', variables);
    await ov.views({ id: 'c2' });
    expect(run).toHaveBeenLastCalledWith(OPEN_VIEWS_QUERIES.views, { id: 'c2', view: 'methods' });
    await ov.forward({ id: 'c2', type: 'Class' }, 'source').reload();
    expect(run).toHaveBeenLastCalledWith(OPEN_VIEWS_QUERIES.view, { id: 'c2', view: 'source' });
  });

  it('rejects an answer that is not what the protocol says', async () => {
    const { source } = fakeSource({ items: 'nope' });
    await expect(openViewSource(source, 'view', variables).items('0', 0)).rejects.toThrow(/unexpected items/);
  });
});
