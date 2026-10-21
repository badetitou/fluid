export interface DemoSource {
  key: string;
  label: string;
  url: string;
  description: string;
  concepts: string[];
}

// Public, CORS-enabled GraphQL APIs checked against Fluid's introspection,
// auto lists and detail views, to try it without running anything.
export const DEMO_SOURCES: DemoSource[] = [
  {
    key: 'rick-and-morty',
    label: 'Rick and Morty',
    url: 'https://rickandmortyapi.com/graphql',
    description: 'Characters of the show, the places they live and the episodes they appear in.',
    concepts: ['Character', 'Location', 'Episode'],
  },
  {
    key: 'countries',
    label: 'Countries',
    url: 'https://countries.trevorblades.com/',
    description: 'Every country with its continent, languages, currency and capital.',
    concepts: ['Country', 'Continent', 'Language'],
  },
  {
    key: 'graphqlzero',
    label: 'GraphQLZero (blog & todos)',
    url: 'https://graphqlzero.almansi.me/api',
    description: 'Fake users with their posts, comments, albums, photos and todos.',
    concepts: ['User', 'Post', 'Comment', 'Album', 'Photo', 'Todo'],
  },
];
