'use client';

import { useEffect } from 'react';
import { ACADEMIC_CACHE_IDENTITY } from '../domain/browser-cache';
import {
  ACADEMIC_IDENTITY_CHANGED,
  setAcademicCacheIdentity,
  suspendAcademicCacheIdentity,
} from '../infrastructure/browser-courses';

export function AcademicCacheIdentity({ userId }: Readonly<{ userId: string | null }>) {
  useEffect(() => {
    setAcademicCacheIdentity(userId);
    const changeAccount = () => {
      suspendAcademicCacheIdentity();
      window.location.reload();
    };
    const storageChanged = (event: StorageEvent) => {
      if (
        (event.key === ACADEMIC_CACHE_IDENTITY && event.newValue !== userId) ||
        event.key === null
      )
        changeAccount();
    };
    const pageRestored = (event: PageTransitionEvent) => {
      if (event.persisted) changeAccount();
    };
    window.addEventListener('pageshow', pageRestored);
    window.addEventListener('storage', storageChanged);
    window.addEventListener(ACADEMIC_IDENTITY_CHANGED, changeAccount);
    return () => {
      window.removeEventListener('pageshow', pageRestored);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener(ACADEMIC_IDENTITY_CHANGED, changeAccount);
    };
  }, [userId]);
  return null;
}
