// Test fixture: a class as the Pharo / Moose API answers the curated blueprint
// query (calls through invocation candidates, callers through senders,
// accesses through variables). "x:1" is a method of another class.

const ref = (id: string) => ({ id });
const calls = (...ids: string[]) => ids.map((id) => ({ candidates: [ref(id)] }));
const callers = (...ids: string[]) => ids.map((id) => ({ sender: ref(id) }));
const accesses = (...ids: string[]) => ids.map((id) => ({ variable: ref(id) }));

const method = (
  id: string,
  selector: string,
  linesOfCode: number,
  more: Record<string, unknown> = {},
) => ({
  id,
  selector,
  protocol: 'public',
  linesOfCode,
  isAbstract: false,
  isOverriding: false,
  sourceCode: `${selector}\n\t"..."`,
  outgoingInvocations: [],
  incomingInvocations: [],
  accesses: [],
  ...more,
});

export const growAtLast = method('2:7', 'growAtLast', 12, {
  protocol: 'growing',
  accesses: accesses('3:3'),
});

export const orderedCollection = {
  id: '1:1',
  name: 'OrderedCollection',
  attributes: [
    { id: '3:1', name: 'firstIndex' },
    { id: '3:2', name: 'lastIndex' },
    { id: '3:3', name: 'array' },
  ],
  methods: [
    method('2:1', 'initialize', 4, { accesses: accesses('3:1', '3:2') }),
    method('2:2', 'add:', 3, {
      outgoingInvocations: calls('2:3'),
      incomingInvocations: callers('x:1'),
    }),
    method('2:3', 'addLast:', 8, {
      outgoingInvocations: calls('2:5'),
      incomingInvocations: callers('2:2', 'x:1'),
      accesses: accesses('3:3', '3:2'),
    }),
    method('2:4', 'removeFirst', 9, {
      outgoingInvocations: calls('2:6'),
      accesses: accesses('3:3', '3:1'),
    }),
    method('2:5', 'makeRoomAtLast', 6, {
      outgoingInvocations: calls('2:7'),
      incomingInvocations: callers('2:3'),
    }),
    method('2:6', 'emptyCheck', 3, { isOverriding: true, incomingInvocations: callers('2:4') }),
    growAtLast,
    method('2:8', 'firstIndex', 2, { accesses: accesses('3:1') }),
    method('2:9', 'isEmpty', 2, { isAbstract: true }),
  ],
};
