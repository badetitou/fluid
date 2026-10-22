// Test fixture: classes as the Pharo / Moose API answers the curated class
// diagram query (superclasses through Inheritance objects, nested).

const pkg = (name: string) => ({ name });
const inherits = (superclass: object) => [{ superclass }];
const members = (...names: string[]) => names.map((name, i) => ({ id: `m:${name}:${i}`, name }));

const protoObject = { id: '1:1', name: 'ProtoObject', isAbstract: false, parentPackage: pkg('Kernel'), superInheritances: [] };
const object = { id: '1:2', name: 'Object', isAbstract: false, parentPackage: pkg('Kernel'), superInheritances: inherits(protoObject) };
const collection = {
  id: '1:3',
  name: 'Collection',
  isAbstract: true,
  parentPackage: pkg('Collections-Abstract'),
  superInheritances: inherits(object),
};
const hashed = {
  id: '1:4',
  name: 'HashedCollection',
  isAbstract: false,
  parentPackage: pkg('Collections-Abstract'),
  superInheritances: inherits(collection),
};
const algorithm = {
  id: '1:5',
  name: 'AIGraphAlgorithm',
  isAbstract: true,
  parentPackage: pkg('AI-Algorithms-Graph'),
  superInheritances: inherits(object),
};

export const setClass = {
  id: '1:10',
  name: 'Set',
  isAbstract: false,
  numberOfMethods: 42,
  parentPackage: pkg('Collections-Unordered'),
  attributes: [],
  methods: members('add:', 'do:'),
  superInheritances: inherits(hashed),
};

/** Eight classes once the superclasses are collected: ProtoObject → Object → … */
export const pharoClasses = [
  setClass,
  {
    id: '1:11',
    name: 'Bag',
    isAbstract: false,
    numberOfMethods: 7,
    parentPackage: pkg('Collections-Unordered'),
    attributes: members('contents'),
    methods: members('add:', 'remove:', 'do:', 'size', 'includes:', 'occurrencesOf:', 'asSet'),
    superInheritances: inherits(hashed),
  },
  {
    id: '1:12',
    name: 'AIPrim',
    isAbstract: false,
    numberOfMethods: 1,
    parentPackage: pkg('AI-Algorithms-Graph'),
    attributes: [],
    methods: members('run'),
    superInheritances: inherits(algorithm),
  },
];
