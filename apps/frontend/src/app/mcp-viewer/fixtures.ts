// Test fixtures of the viewer.
export const SPEC = {
  version: 1,
  id: 'v1',
  concept: 'Character',
  title: 'Characters',
  queries: { list: { query: 'query($take: Int){ characters(take: $take){ id name } }', variables: { take: 20 } } },
  widgets: [{ id: 'w1', type: 'table', title: 'All', data: { query: 'list', path: 'characters' }, columns: [{ key: 'name' }] }],
};
