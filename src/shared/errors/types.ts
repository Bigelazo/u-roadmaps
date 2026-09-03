import type { ResultAsync } from 'neverthrow';

export type ApplicationErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class ApplicationError extends Error {
  constructor(
    readonly status: ApplicationErrorStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly source?: 'P2003',
  ) {
    super(message);
  }
}

export type ApplicationResult<Value> = ResultAsync<Value, ApplicationError>;
