import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  ACADEMIC_HISTORY_LIMIT,
  ACADEMIC_HISTORY_TTL_MS,
  createMufasaUCampus,
  forgetAcademicHistory,
} from '@/integrations/ucampus/server';

const enrolledCourse = {
  codigo: 'CC5002',
  nombre: 'Desarrollo de software',
  ano: 2026,
  periodo: 2,
};

let failing = false;
const historyRequests = () =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('cursos_inscritos')).length;

const sharedHistory = (rut: string) =>
  createMufasaUCampus({ sharedAcademicHistory: true }).getAcademicHistory(rut);

beforeEach(() => {
  failing = false;
  vi.useFakeTimers();
  vi.stubEnv('MUFASA_TOKEN', 'private-token');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) =>
      failing
        ? new Response('', { status: 503 })
        : Response.json(url.pathname.endsWith('/cursos_dictados') ? [] : [enrolledCourse]),
    ),
  );
});

afterEach(() => {
  for (let index = 0; index <= ACADEMIC_HISTORY_LIMIT + 1; index += 1)
    forgetAcademicHistory(String(10_000_000 + index));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('two page renders within a day ask MUFASA once', async () => {
  const first = await sharedHistory('10000000');
  const second = await sharedHistory('10000000');
  expect(second).toEqual(first);
  expect(first.status).toBe('complete');
  expect(historyRequests()).toBe(1);
});

test('concurrent renders share one MUFASA request', async () => {
  await Promise.all([sharedHistory('10000000'), sharedHistory('10000000')]);
  expect(historyRequests()).toBe(1);
});

test('a history older than a day is requested again', async () => {
  await sharedHistory('10000000');
  vi.advanceTimersByTime(ACADEMIC_HISTORY_TTL_MS - 1);
  await sharedHistory('10000000');
  expect(historyRequests()).toBe(1);
  vi.advanceTimersByTime(1);
  await sharedHistory('10000000');
  expect(historyRequests()).toBe(2);
});

test('forgetting a RUT requests its history again', async () => {
  await sharedHistory('10000000');
  forgetAcademicHistory('10000000');
  await sharedHistory('10000000');
  expect(historyRequests()).toBe(2);
});

test('an unavailable history is never shared', async () => {
  failing = true;
  await expect(sharedHistory('10000000')).resolves.toEqual({ status: 'unavailable' });
  failing = false;
  await expect(sharedHistory('10000000')).resolves.toMatchObject({ status: 'complete' });
  expect(historyRequests()).toBe(2);
});

test('the oldest RUT leaves once the limit is reached', async () => {
  for (let index = 0; index <= ACADEMIC_HISTORY_LIMIT; index += 1)
    await sharedHistory(String(10_000_000 + index));
  expect(historyRequests()).toBe(ACADEMIC_HISTORY_LIMIT + 1);
  await sharedHistory(String(10_000_000 + ACADEMIC_HISTORY_LIMIT));
  await sharedHistory('10000001');
  expect(historyRequests()).toBe(ACADEMIC_HISTORY_LIMIT + 1);
  await sharedHistory('10000000');
  expect(historyRequests()).toBe(ACADEMIC_HISTORY_LIMIT + 2);
});

test('an adapter without sharing keeps asking MUFASA on every request', async () => {
  await sharedHistory('10000000');
  await createMufasaUCampus().getAcademicHistory('10000000');
  expect(historyRequests()).toBe(2);
});
