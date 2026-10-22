// A minimal reader of the GraphQL document of an action: enough to check that it
// is a single mutation, to list the root fields it calls and the variables it
// declares. Not a full GraphQL parser (shared has no GraphQL dependency): the
// source checks the rest when the mutation runs.

export interface DeclaredVariable {
  name: string;
  /** Its GraphQL type as written, e.g. `UpdateTodoInput!` or `[ID!]`. */
  type: string;
  /** Non-null without a default value: the action must provide it. */
  required: boolean;
}

export interface MutationDocument {
  /** Root fields the mutation calls (not their aliases). */
  fields: string[];
  variables: DeclaredVariable[];
}

export type ParsedMutation = { ok: true; document: MutationDocument } | { ok: false; error: string };

type Token = { kind: 'name' | 'punct' | 'value'; text: string };

const PUNCT = new Set(['!', '$', '&', '(', ')', ':', '=', '@', '[', ']', '{', '|', '}']);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/[\s,﻿]/.test(c)) i++;
    else if (c === '#') while (i < source.length && source[i] !== '\n') i++;
    else if (source.startsWith('"""', i)) {
      const end = source.indexOf('"""', i + 3);
      i = end < 0 ? source.length : end + 3;
      tokens.push({ kind: 'value', text: 'string' });
    } else if (c === '"') {
      i++;
      while (i < source.length && source[i] !== '"' && source[i] !== '\n') i += source[i] === '\\' ? 2 : 1;
      i++;
      tokens.push({ kind: 'value', text: 'string' });
    } else if (source.startsWith('...', i)) {
      tokens.push({ kind: 'punct', text: '...' });
      i += 3;
    } else if (PUNCT.has(c)) {
      tokens.push({ kind: 'punct', text: c });
      i++;
    } else {
      const word = /^[_A-Za-z0-9.+-]+/.exec(source.slice(i))?.[0] ?? c;
      tokens.push({ kind: /^[_A-Za-z]/.test(word) ? 'name' : 'value', text: word });
      i += word.length;
    }
  }
  return tokens;
}

/** Index just after the bracket closing the one at `start` (`(`, `[` or `{`), or -1 when unbalanced. */
function skipGroup(tokens: Token[], start: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i].text;
    if (tokens[i].kind !== 'punct') continue;
    if (pairs[t]) stack.push(pairs[t]);
    else if (t === ')' || t === ']' || t === '}') {
      if (stack.pop() !== t) return -1;
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/** Variable definitions between `(` at `start` and its `)`. */
function readVariables(tokens: Token[], start: number, end: number): DeclaredVariable[] {
  const variables: DeclaredVariable[] = [];
  let i = start + 1;
  while (i < end - 1) {
    if (tokens[i].text !== '$') return variables;
    const name = tokens[i + 1]?.text ?? '';
    i += 3; // `$`, name, `:`
    let type = '';
    let depth = 0;
    while (i < end - 1 && (depth > 0 || !['=', '$', '@'].includes(tokens[i].text))) {
      if (tokens[i].text === '[') depth++;
      if (tokens[i].text === ']') depth--;
      type += tokens[i].text;
      i++;
    }
    const hasDefault = tokens[i]?.text === '=';
    while (i < end - 1 && tokens[i].text !== '$') i = /[([{]/.test(tokens[i].text) ? skipGroup(tokens, i) : i + 1;
    variables.push({ name, type, required: type.endsWith('!') && !hasDefault });
  }
  return variables;
}

/** Root fields of the selection set `{` at `start`, closing at `end`. */
function readRootFields(tokens: Token[], start: number, end: number): string[] {
  const fields: string[] = [];
  let i = start + 1;
  while (i < end - 1) {
    const t = tokens[i];
    if (t.text === '(' || t.text === '{') i = skipGroup(tokens, i);
    else if (t.text === '@' || t.text === '...') i += 2;
    else if (t.kind === 'name') {
      const aliased = tokens[i + 1]?.text === ':';
      fields.push(aliased ? tokens[i + 2]?.text ?? '' : t.text);
      i += aliased ? 3 : 1;
    } else i++;
  }
  return fields;
}

/** Read the document of an action: exactly one operation, which must be a mutation. */
export function parseMutationDocument(source: string): ParsedMutation {
  const tokens = tokenize(source);
  const operations: { type: string; start: number; end: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const type = tokens[i].text === '{' ? 'query' : tokens[i].text;
    let j = i;
    while (j >= 0 && j < tokens.length && tokens[j].text !== '{') {
      j = tokens[j].text === '(' ? skipGroup(tokens, j) : j + 1;
    }
    if (j < 0 || j >= tokens.length) return { ok: false, error: 'The document has no selection set.' };
    const end = skipGroup(tokens, j);
    if (end < 0) return { ok: false, error: 'Unbalanced brackets in the document.' };
    operations.push({ type, start: i, end });
    i = end;
  }
  if (operations.length !== 1) {
    return { ok: false, error: `Expected exactly one operation and no fragment, found ${operations.length} definitions.` };
  }
  const [op] = operations;
  if (op.type !== 'mutation') return { ok: false, error: `Expected a mutation, found a ${op.type}.` };

  let k = op.start + 1;
  if (tokens[k]?.kind === 'name') k++;
  let variables: DeclaredVariable[] = [];
  if (tokens[k]?.text === '(') {
    const close = skipGroup(tokens, k);
    variables = readVariables(tokens, k, close);
    k = close;
  }
  while (tokens[k] && tokens[k].text !== '{') k++;
  const fields = readRootFields(tokens, k, op.end);
  if (fields.length === 0) return { ok: false, error: 'The mutation calls no field.' };
  return { ok: true, document: { fields, variables } };
}
