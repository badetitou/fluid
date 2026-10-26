/**
 * Presentation frames can nest (a widget presented from a presented view).
 * Escape leaves only the innermost one: frames register here while active and
 * only the top of the stack reacts.
 */
const stack: symbol[] = [];

/** Registers an active frame; returns the function that unregisters it. */
export function enterPresentation(id: symbol): () => void {
  stack.push(id);
  return () => {
    const at = stack.lastIndexOf(id);
    if (at >= 0) stack.splice(at, 1);
  };
}

/** Whether `id` is the innermost active frame. */
export function isTopPresentation(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}
