import type { ViewSpec } from '../view-spec';

/**
 * A curated co-usage map on the public Rick and Morty API: the characters of
 * the first page in rows, the episodes they appear in as columns.
 */
export const characterEpisodesMatrixExample: ViewSpec = {
  version: 1,
  id: 'builtin:character-episodes-matrix',
  concept: 'Character',
  scope: 'list',
  title: 'Characters × episodes',
  description: 'Which character appears in which episode, grouped by species.',
  queries: {
    characters: {
      query: /* GraphQL */ `
        query FluidCharacterEpisodesMatrix {
          characters(page: 1) {
            results {
              id
              name
              species
              episode {
                id
                name
                code: episode
                air_date
              }
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'appearances',
      type: 'matrix',
      title: 'Appearances',
      span: 18,
      height: 560,
      data: { query: 'characters', path: 'characters.results' },
      targetsField: 'episode',
      targetLabelField: 'code',
      columns: 'targets',
      groupField: 'species',
      linkTo: { concept: 'Character', idField: 'id' },
      targetLinkTo: { concept: 'Episode', idField: 'id' },
    },
    {
      id: 'episode',
      type: 'descriptions',
      title: 'Selected episode',
      span: 6,
      data: { query: '@appearances', path: 'selected.target' },
      columns: 1,
      items: [
        { label: 'Episode', key: 'name' },
        { label: 'Code', key: 'code', format: 'tag' },
        { label: 'Aired', key: 'air_date' },
      ],
    },
  ],
};

/**
 * A curated dependency structure matrix for code-analysis APIs exposing a
 * `Class` concept (Moose / a Pharo image): which class calls which, through
 * the invocations of its methods. No public API ships one: it serves as a reference.
 */
export const classDependencyMatrixExample: ViewSpec = {
  version: 1,
  id: 'builtin:class-dsm',
  concept: 'Class',
  scope: 'list',
  title: 'Class dependencies (DSM)',
  description: 'Which class calls which, grouped by package, with the cycles highlighted.',
  queries: {
    classes: {
      query: /* GraphQL */ `
        query FluidClassDsm($take: Int) {
          classes(take: $take) {
            id
            name
            parentPackage {
              name
            }
            methods {
              outgoingInvocations {
                candidates {
                  parentType {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      variables: { take: 200 },
    },
  },
  widgets: [
    {
      id: 'dsm',
      type: 'matrix',
      title: 'Calls between classes',
      span: 24,
      height: 640,
      data: { query: 'classes', path: 'classes' },
      targetsField: 'methods.outgoingInvocations.candidates.parentType',
      groupField: 'parentPackage.name',
      linkTo: { concept: 'Class', idField: 'id' },
    },
  ],
};
