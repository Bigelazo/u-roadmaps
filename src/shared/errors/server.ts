import 'server-only';

import { ResultAsync } from 'neverthrow';
import { unstable_rethrow } from 'next/navigation';
import { Prisma } from '@/shared/server/db';
import { ApplicationError, type ApplicationResult } from '@/shared/errors/types';

export { ApplicationError, type ApplicationResult } from '@/shared/errors/types';

function normalizeApplicationError(error: unknown): ApplicationError {
  unstable_rethrow(error);
  if (error instanceof ApplicationError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return new ApplicationError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    }
    if (error.code === 'P2003') {
      return new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con datos relacionados.',
        undefined,
        'P2003',
      );
    }
    if (error.code === 'P2002' || error.code === 'P2034') {
      return new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con un recurso existente.',
      );
    }
  }

  console.error(error);
  return new ApplicationError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
}

export function applicationResult<Value>(
  operation: () => Promise<Value>,
): ApplicationResult<Value> {
  return ResultAsync.fromPromise(Promise.resolve().then(operation), normalizeApplicationError);
}
