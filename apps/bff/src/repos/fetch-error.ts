/** A download or extraction failure whose message is safe to show (no secret, no server path). */
export class RepoFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepoFetchError';
  }
}
