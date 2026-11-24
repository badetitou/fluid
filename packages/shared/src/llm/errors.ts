/** Transport/provider failure (network, non-2xx, malformed response). */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

/** The model returned content that never validated as a view draft. */
export class LlmValidationError extends Error {
  errorText: string;
  raw: string;
  constructor(errorText: string, raw: string, message = 'LLM produced an invalid view draft') {
    super(message);
    this.name = 'LlmValidationError';
    this.errorText = errorText;
    this.raw = raw;
  }
}
