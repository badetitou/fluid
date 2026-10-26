// Test fixtures: classes as a Moose / Pharo API answers the curated DSM query
// (callees through the invocations of the methods), and Rick and Morty
// characters with their episodes for the co-usage map.

/** A method calling the classes `ids` (one invocation each). */
const calls = (...ids: string[]) => ({
  outgoingInvocations: ids.map((id) => ({ candidates: [{ parentType: { id } }] })),
});
const pkg = (name: string) => ({ name });

export const kernelClass = { id: 'c:A', name: 'Array', parentPackage: pkg('Collections'), methods: [calls('c:B', 'c:B'), calls('c:C')] };

/**
 * Array → Bag ×2, Array → Collection; Bag → Array (a cycle with Array) and Bag → Bag (diagonal);
 * Collection → Dictionary; Dictionary → Object, which is not among the rows.
 */
export const dsmClasses = [
  kernelClass,
  { id: 'c:B', name: 'Bag', parentPackage: pkg('Collections'), methods: [calls('c:A', 'c:B')] },
  { id: 'c:C', name: 'Collection', parentPackage: pkg('Abstract'), methods: [calls('c:D')] },
  { id: 'c:D', name: 'Dictionary', parentPackage: pkg('Abstract'), methods: [calls('c:X')] },
];

const episode = (id: string, code: string, name: string) => ({ id, code, name, air_date: 'December 2, 2013' });
export const pilot = episode('1', 'S01E01', 'Pilot');
const lawnmower = episode('2', 'S01E02', 'Lawnmower Dog');
const anatomy = episode('3', 'S01E03', 'Anatomy Park');

export const rickAndMortyCharacters = {
  characters: {
    results: [
      { id: '1', name: 'Rick Sanchez', species: 'Human', episode: [pilot, lawnmower, anatomy] },
      { id: '2', name: 'Morty Smith', species: 'Human', episode: [pilot, lawnmower] },
      { id: '6', name: 'Abadango Cluster Princess', species: 'Alien', episode: [anatomy] },
    ],
  },
};
