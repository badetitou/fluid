// Test fixture: a method as the Pharo / Moose API answers the curated butterfly
// query (callers through `incomingInvocations.sender`, callees through
// `outgoingInvocations.candidates`).

const type = (name: string) => ({ name });
const method = (id: string, name: string, cls: string, numberOfLinesOfCode = 5) => ({
  id,
  name,
  numberOfLinesOfCode,
  parentType: type(cls),
});

export const printString = method('2:1', 'printString', 'Object', 3);
export const displayString = method('2:2', 'displayString', 'Object');
export const printOn = method('2:3', 'printOn:', 'Collection', 12);
export const nextPutAll = method('2:4', 'nextPutAll:', 'WriteStream', 8);
export const writeStream = method('2:5', 'writeStream', 'String', 4);

/** `Object>>printStringLimitedTo:`: called by two methods (one twice), calling three (one twice). */
export const centerMethod = {
  ...method('2:0', 'printStringLimitedTo:', 'Object', 9),
  incomingInvocations: [{ sender: printString }, { sender: displayString }, { sender: printString }],
  outgoingInvocations: [
    { candidates: [printOn] },
    { candidates: [nextPutAll] },
    { candidates: [writeStream] },
    { candidates: [nextPutAll] },
  ],
};
