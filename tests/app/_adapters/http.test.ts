import { expect, test } from 'vitest';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { applicationErrorResponse, parseJsonObject } from '@/app/_adapters/http';
import { ApplicationError } from '@/shared/errors/types';

test('translates an invalid Course offering identifier into the existing HTTP error', async () => {
  let error: unknown;
  try {
    requireCourseOfferingIdentifier({ courseCode: '  ', year: '2026', semester: '1' });
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ApplicationError);
  expect(error).toMatchObject({
    status: 400,
    code: 'INVALID_ACADEMIC_IDENTITY',
    message: 'El ramo, año y semestre no forman una identidad académica válida.',
  });
});

test('serializes application errors without changing their HTTP contract', async () => {
  const response = applicationErrorResponse(
    new ApplicationError(409, 'CONFLICT', 'No se puede completar la operación.', {
      resourceId: 'resource-1',
    }),
  );

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: 'CONFLICT',
      message: 'No se puede completar la operación.',
      details: { resourceId: 'resource-1' },
    },
  });
});

test('parses JSON request bodies as objects at the HTTP boundary', async () => {
  await expect(
    parseJsonObject(
      new Request('http://localhost/api/roadmap', {
        method: 'POST',
        body: JSON.stringify({ title: 'Introducción' }),
      }),
    ),
  ).resolves.toEqual({ title: 'Introducción' });
});

test.each([
  ['malformed JSON', '{'],
  ['a JSON array', '[]'],
  ['a JSON scalar', '"roadmap"'],
])('%s keeps the existing request-body error contract', async (_description, body) => {
  await expect(
    parseJsonObject(
      new Request('http://localhost/api/roadmap', {
        method: 'POST',
        body,
      }),
    ),
  ).rejects.toMatchObject({ status: 400, code: body === '{' ? 'INVALID_JSON' : 'INVALID_REQUEST' });
});
