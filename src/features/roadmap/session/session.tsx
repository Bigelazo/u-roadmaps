'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { httpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';
import type { StudentRoadmapDto } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionInput, RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

const persistenceContext = createContext<RoadmapCanvasSessionPersistence>(
  httpRoadmapCanvasSessionPersistence,
);

function offeringKey(input: RoadmapCanvasSessionInput) {
  const { courseCode, year, semester } = input.courseOffering.identifier;
  return `${courseCode}:${year}:${semester}`;
}

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function RoadmapCanvasSessionPersistenceProvider({
  persistence,
  children,
}: {
  persistence: RoadmapCanvasSessionPersistence;
  children: ReactNode;
}) {
  return <persistenceContext.Provider value={persistence}>{children}</persistenceContext.Provider>;
}

export function useRoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  const persistence = useContext(persistenceContext);
  const [roadmap, setRoadmap] = useState<StudentRoadmapDto | null>(null);
  const [roadmapKey, setRoadmapKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const activeKeyRef = useRef(offeringKey(input));
  const requestVersionRef = useRef(0);
  const key = offeringKey(input);
  const sessionInput = useMemo<RoadmapCanvasSessionInput>(
    () => ({
      courseOffering: {
        identifier: {
          courseCode: input.courseOffering.identifier.courseCode,
          year: input.courseOffering.identifier.year,
          semester: input.courseOffering.identifier.semester,
        },
        title: input.courseOffering.title,
      },
      experience:
        input.experience.kind === 'student'
          ? { kind: 'student', term: input.experience.term }
          : { kind: 'teaching', term: input.experience.term },
    }),
    [
      input.courseOffering.identifier.courseCode,
      input.courseOffering.identifier.semester,
      input.courseOffering.identifier.year,
      input.courseOffering.title,
      input.experience.kind,
      input.experience.term,
    ],
  );

  useEffect(() => {
    activeKeyRef.current = key;
    const requestVersion = ++requestVersionRef.current;
    void persistence.load(sessionInput).then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        setRoadmap(loadedRoadmap);
        setRoadmapKey(key);
        setError(null);
        setErrorKey(null);
      },
      (cause: unknown) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        setError(messageFor(cause, 'No se pudo cargar el roadmap.'));
        setErrorKey(key);
      },
    );
    return () => {
      requestVersionRef.current += 1;
    };
  }, [key, persistence, sessionInput]);

  const dismissError = useCallback(() => {
    setError(null);
    setErrorKey(null);
  }, []);
  const completeNode = useCallback(
    async (nodeId: string) => {
      const requestKey = offeringKey(sessionInput);
      try {
        await persistence.complete(sessionInput, nodeId);
        if (activeKeyRef.current !== requestKey) return false;
        const loadedRoadmap = await persistence.load(sessionInput);
        if (activeKeyRef.current !== requestKey) return false;
        setRoadmap(loadedRoadmap);
        setRoadmapKey(requestKey);
        setError(null);
        return true;
      } catch (cause) {
        if (activeKeyRef.current === requestKey) {
          setError(messageFor(cause, 'No se pudo completar el nodo.'));
          setErrorKey(requestKey);
        }
        return false;
      }
    },
    [persistence, sessionInput],
  );

  return useMemo(
    () => ({
      roadmap: roadmapKey === key ? roadmap : null,
      error: errorKey === key ? error : null,
      dismissError,
      completeNode,
    }),
    [completeNode, dismissError, error, errorKey, key, roadmap, roadmapKey],
  );
}
