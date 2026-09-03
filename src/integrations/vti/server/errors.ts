import { invalidVtiClaims } from './claims';

type VtiAuthenticationErrorCode =
  'AUTH_CONFIGURATION_ERROR' | 'INVALID_AUTH_CALLBACK' | typeof invalidVtiClaims;

export type VtiIdentity = Readonly<{
  rut: string;
  institutionalEmail: string;
  name: string;
  preferredUsername: string | undefined;
}>;

export class VtiAuthenticationError extends Error {
  constructor(
    readonly status: 400 | 403 | 500,
    readonly code: VtiAuthenticationErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
