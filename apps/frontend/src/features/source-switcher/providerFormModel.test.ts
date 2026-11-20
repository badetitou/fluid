import { describe, expect, it } from 'vitest';
import { isAbort, providerFormError, providerInput } from './providerFormModel';

describe('provider add form', () => {
  it('sends the trimmed input, never an empty one', () => {
    expect(providerInput('  a/b ')).toBe('a/b');
    expect(providerInput('   ')).toBeNull();
  });

  it('shows the provider’s message, or a generic one', () => {
    expect(providerFormError(new Error('Expected owner/name'))).toBe('Expected owner/name');
    expect(providerFormError('busy')).toBe('busy');
    expect(providerFormError(undefined)).toBe('The source could not be added.');
    expect(providerFormError(new Error(' '))).toBe('The source could not be added.');
  });

  it('tells an abort from a failure', () => {
    expect(isAbort(new DOMException('gone', 'AbortError'))).toBe(true);
    expect(isAbort(new Error('AbortError'))).toBe(false);
  });
});
