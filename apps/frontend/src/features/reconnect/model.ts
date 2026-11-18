import type { AuthRequired } from '../../entities/source';

/** What the "Reconnect" prompt says, by why the source asked to sign in again. */
export function reconnectMessage(required: AuthRequired): string {
  switch (required.reason) {
    case 'expired':
      return 'Your sign-in to this source expired.';
    case 'insufficient_scope':
      return required.scope
        ? `This source needs more access (scope “${required.scope}”) than your sign-in grants.`
        : 'This source needs more access than your sign-in grants.';
    default:
      return 'This source needs you to sign in.';
  }
}
