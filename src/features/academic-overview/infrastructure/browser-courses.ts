import type { AcademicOverviewBrowserResponse } from '../types';
import {
  ACADEMIC_CACHE_IDENTITY,
  ACADEMIC_CACHE_PREFIX,
  parseAcademicCourseCache,
  type AcademicCourseCache,
} from '../domain/browser-cache';

const requests = new Map<string, Promise<AcademicOverviewBrowserResponse>>();
let identity: string | null = null;
let generation = 0;
export const ACADEMIC_IDENTITY_CHANGED = 'academic-identity-changed';

export function readAcademicCourseCache(userId: string, allowExpired = false) {
  try {
    return parseAcademicCourseCache(
      window.localStorage.getItem(ACADEMIC_CACHE_PREFIX + userId),
      userId,
      Date.now(),
      allowExpired,
    );
  } catch {
    return null;
  }
}

export function suspendAcademicCacheIdentity() {
  identity = null;
  generation += 1;
  requests.clear();
}

export function clearAcademicCourseCache() {
  suspendAcademicCacheIdentity();
  try {
    const storage = window.localStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith(ACADEMIC_CACHE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    return;
  }
}

export function setAcademicCacheIdentity(userId: string | null) {
  if (identity !== userId) {
    identity = userId;
    generation += 1;
    requests.clear();
  }
  try {
    const storage = window.localStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith(ACADEMIC_CACHE_PREFIX) && key !== ACADEMIC_CACHE_PREFIX + userId)
        storage.removeItem(key);
    }
    if (storage.getItem(ACADEMIC_CACHE_IDENTITY) !== userId) {
      if (userId === null) storage.removeItem(ACADEMIC_CACHE_IDENTITY);
      else storage.setItem(ACADEMIC_CACHE_IDENTITY, userId);
    }
  } catch {
    return;
  }
}

function storeCache(cache: AcademicCourseCache) {
  try {
    window.localStorage.setItem(ACADEMIC_CACHE_PREFIX + cache.userId, JSON.stringify(cache));
  } catch {
    return;
  }
}

async function requestOverview(userId: string, synchronize: boolean, requestGeneration: number) {
  const response = await fetch('/api/academic-overview/browser', {
    method: synchronize ? 'POST' : 'GET',
    cache: 'no-store',
  });
  if (response.status === 401) {
    setAcademicCacheIdentity(null);
    window.dispatchEvent(new Event(ACADEMIC_IDENTITY_CHANGED));
    throw new Error('La sesión terminó. Vuelve a iniciar sesión.');
  }
  if (!response.ok) throw new Error('No pudimos cargar tus cursos. Inténtalo nuevamente.');
  const result: AcademicOverviewBrowserResponse = await response.json();
  if (result.userId !== userId || identity !== userId || generation !== requestGeneration) {
    window.dispatchEvent(new Event(ACADEMIC_IDENTITY_CHANGED));
    throw new Error('La cuenta cambió. Recarga la página para continuar.');
  }
  if (result.cache) storeCache(result.cache);
  return result;
}

export function loadAcademicOverview(
  userId: string,
  refresh = false,
): Promise<AcademicOverviewBrowserResponse> {
  const existing = requests.get(userId);
  if (existing) return existing;
  const requestGeneration = generation;
  const previous = readAcademicCourseCache(userId);
  const load = async () => {
    if (generation !== requestGeneration)
      throw new Error('La cuenta cambió. Recarga la página para continuar.');
    const current = readAcademicCourseCache(userId);
    const synchronizedElsewhere =
      current && current.synchronizedAt > (previous?.synchronizedAt ?? 0);
    return requestOverview(
      userId,
      !current || (refresh && !synchronizedElsewhere),
      requestGeneration,
    );
  };
  let lockEntered = false;
  const coordinatedLoad = () => {
    lockEntered = true;
    return load();
  };
  const request = (
    navigator.locks
      ? navigator.locks.request(ACADEMIC_CACHE_PREFIX + userId, coordinatedLoad).catch((error) => {
          if (lockEntered) throw error;
          return load();
        })
      : load()
  ).finally(() => {
    if (requests.get(userId) === request) requests.delete(userId);
  });
  requests.set(userId, request);
  return request;
}
