import { describe, expect, it } from 'vitest';
import { detectTextFormat, guessLanguage, resolveFormat, textOf } from './richTextModel';

describe('textOf', () => {
  it('reads a field of the bound object, or the binding itself', () => {
    expect(textOf({ body: '# Hi' }, 'body')).toBe('# Hi');
    expect(textOf('plain', undefined)).toBe('plain');
    expect(textOf([{ body: 'first' }, { body: 'second' }], 'body')).toBe('first');
  });

  it('joins several values and pretty-prints objects', () => {
    expect(textOf({ notes: ['a', null, 'b'] }, 'notes')).toBe('a\n\nb');
    expect(textOf({ config: { a: 1 } }, 'config')).toBe('{\n  "a": 1\n}');
    expect(textOf(null, 'body')).toBe('');
  });
});

describe('detectTextFormat', () => {
  it('recognises Markdown', () => {
    expect(detectTextFormat('# Title\n\nSome **bold** text')).toBe('markdown');
    expect(detectTextFormat('- one\n- two')).toBe('markdown');
  });

  it('recognises code and JSON', () => {
    expect(detectTextFormat('{"a": [1, 2]}')).toBe('code');
    expect(detectTextFormat('import x from "y";\nconst a = () => {\n  return 1;\n}')).toBe('code');
  });

  it('keeps short single-line text plain', () => {
    expect(detectTextFormat('Just a sentence.')).toBe('plain');
  });

  it('is bypassed by an explicit format', () => {
    expect(resolveFormat('# not markdown', 'code')).toBe('code');
  });
});

describe('guessLanguage', () => {
  it('uses the hint, else the text', () => {
    expect(guessLanguage('x', 'Python')).toBe('python');
    expect(guessLanguage('{"a":1}')).toBe('json');
    expect(guessLanguage('SELECT * FROM t')).toBe('sql');
    expect(guessLanguage('query { users { id } }')).toBe('graphql');
    expect(guessLanguage('<div></div>')).toBe('markup');
    expect(guessLanguage('const a = 1;')).toBe('tsx');
  });
});
