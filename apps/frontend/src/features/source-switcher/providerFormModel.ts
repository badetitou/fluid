/** What the user typed in a provider's add form, trimmed, or `null` when there is nothing to send. */
export const providerInput = (raw: string): string | null => raw.trim() || null;

/** The message shown under the field when a provider refused the input. */
export function providerFormError(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return message.trim() || 'The source could not be added.';
}

/** Whether a failure is only the form going away (nothing to show). */
export const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';
