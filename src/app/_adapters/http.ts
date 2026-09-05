import { NextResponse } from 'next/server';
import {
  ApplicationError,
  applicationResult,
  type ApplicationResult,
} from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;

export function applicationErrorResponse(error: ApplicationError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

export function throwApplicationError(error: ApplicationError): never {
  throw error;
}

export function handleApplicationResult<Success extends Response>(
  operation: () => Promise<Success>,
  onError: (error: ApplicationError) => Response = applicationErrorResponse,
): Promise<Response> {
  return applicationResult(operation).match(
    (response) => response,
    (error) => onError(error),
  );
}

export async function unwrapApplicationResult<Value>(
  result: ApplicationResult<Value>,
): Promise<Value> {
  return result.match((value) => value, throwApplicationError);
}

export async function parseJsonObject(request: Request): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApplicationError(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  return body as JsonObject;
}

export function requireUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un UUID válido.`);
  }
  return value;
}
