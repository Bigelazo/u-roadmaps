import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CachedAcademicOverview } from '@/features/academic-overview';
import {
  loadAcademicOverview,
  readAcademicCourseCache,
  setAcademicCacheIdentity,
} from '@/features/academic-overview/infrastructure/browser-courses';
import {
  ACADEMIC_CACHE_PREFIX,
  createAcademicCourseCache,
} from '@/features/academic-overview/domain/browser-cache';
import type { AcademicOverviewBrowserResponse } from '@/features/academic-overview/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const userId = 'browser-user';
const cache = createAcademicCourseCache(userId, [], Date.now());
const complete: AcademicOverviewBrowserResponse = {
  userId,
  status: 'complete',
  overview: { source: 'MUFASA', terms: [] },
  cache,
};
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  });
  setAcademicCacheIdentity(userId);
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  setAcademicCacheIdentity(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('actual client initialization shares its pending request across Strict Mode effects', async () => {
  let finish!: (response: Response) => void;
  fetcher.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <StrictMode>
      <CachedAcademicOverview userId={userId} renderRoadmapCreation={() => null} />
    </StrictMode>,
  );
  expect(screen.getByRole('status', { name: 'Cargando resumen académico...' })).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
  finish(Response.json(complete));
  await screen.findByRole('heading', { name: 'Resumen académico' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(readAcademicCourseCache(userId)).toEqual(cache);
});

test('concurrent refresh consumers share one pending request and release it after failure', async () => {
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = loadAcademicOverview(userId, true);
  const second = loadAcademicOverview(userId, true);
  expect(first).toBe(second);
  finish(new Response('', { status: 503 }));
  await expect(first).rejects.toThrow('No pudimos cargar');
  fetcher.mockResolvedValueOnce(Response.json(complete));
  await expect(loadAcademicOverview(userId, true)).resolves.toEqual(complete);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('changing accounts discards a late response before it can write history', async () => {
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const request = loadAcademicOverview(userId);
  setAcademicCacheIdentity('another-user');
  finish(Response.json(complete));
  await expect(request).rejects.toThrow('La cuenta cambió');
  expect(window.localStorage.getItem(ACADEMIC_CACHE_PREFIX + userId)).toBeNull();
});

test('a successful synchronization survives a quota error', async () => {
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  fetcher.mockResolvedValueOnce(Response.json(complete));
  await expect(loadAcademicOverview(userId)).resolves.toEqual(complete);
  expect(readAcademicCourseCache(userId)).toBeNull();
});

test('a valid snapshot uses a fresh local read and partial or unavailable refreshes do not overwrite it', async () => {
  window.localStorage.setItem(ACADEMIC_CACHE_PREFIX + userId, JSON.stringify(cache));
  fetcher.mockResolvedValueOnce(Response.json({ ...complete, status: 'local', cache: null }));
  await loadAcademicOverview(userId);
  expect(fetcher).toHaveBeenLastCalledWith('/api/academic-overview/browser', {
    method: 'GET',
    cache: 'no-store',
  });
  for (const status of ['partial', 'unavailable'] as const) {
    fetcher.mockResolvedValueOnce(Response.json({ ...complete, status, cache: null }));
    await loadAcademicOverview(userId, true);
    expect(readAcademicCourseCache(userId)).toEqual(cache);
  }
});

test('a network failure replaces loading with a usable retry control', async () => {
  fetcher.mockRejectedValueOnce(new TypeError('Offline'));
  render(<CachedAcademicOverview userId={userId} renderRoadmapCreation={() => null} />);
  await screen.findByText('No pudimos cargar tus cursos. Revisa tu conexión e intenta nuevamente.');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Actualizar cursos' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
});

test('a denied browser lock falls back to an authenticated request', async () => {
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn().mockRejectedValue(new DOMException('Denied', 'SecurityError')) },
  });
  fetcher.mockResolvedValueOnce(Response.json(complete));
  await expect(loadAcademicOverview(userId)).resolves.toEqual(complete);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
