// Test fixture: classes as the Pharo / Moose API answers the curated polymetric query.

const cls = (id: string, name: string, pkg: string, attrs: number, methods: number, loc: number, parent?: string) => ({
  id,
  name,
  numberOfAttributes: attrs,
  numberOfMethods: methods,
  numberOfLinesOfCode: loc,
  parentPackage: { name: pkg },
  superInheritances: parent ? [{ superclass: { id: parent } }] : [],
});

export const boxClasses = [
  cls('1', 'Object', 'Kernel', 0, 10, 100),
  cls('2', 'Collection', 'Collections', 2, 20, 400, '1'),
  cls('3', 'Set', 'Collections', 4, 40, 900, '2'),
  cls('4', 'Bag', 'Collections', 1, 8, 50, '2'),
  cls('5', 'Point', 'Kernel', 2, 12, 200, '1'),
];
