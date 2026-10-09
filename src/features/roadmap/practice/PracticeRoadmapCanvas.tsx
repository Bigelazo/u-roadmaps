'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { buttonVariants } from '@/shared/ui/button';
import { RoadmapCanvasSession } from '@/features/roadmap/session/RoadmapCanvasSession';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import {
  PRACTICE_COURSE_CODE,
  PRACTICE_ROADMAP_TITLE,
  practiceExitHref,
  practiceNodeChangeCounts,
  practiceRoadmap,
  practiceStudentProgress,
  type PracticeAcademicTerm,
  type PracticeExperience,
} from '@/features/roadmap/practice/practice-roadmap';

/**
 * The real Roadmap canvas over a fresh in-memory copy of the Practice roadmap.
 * Nothing done here reaches the server, and every mount starts over.
 */
export function PracticeRoadmapCanvas({
  experience,
  term,
  today,
  origin,
}: {
  experience: PracticeExperience;
  term: PracticeAcademicTerm;
  today: string;
  origin: string | null;
}) {
  const [persistence] = useState(() =>
    createInMemoryRoadmapSessionPersistence(
      practiceRoadmap(term, today),
      experience === 'student' ? { studentProgress: practiceStudentProgress } : {},
    ),
  );
  return (
    <div data-practice-roadmap>
      <nav
        aria-label="Mapa de práctica"
        className="sticky top-0 z-20 flex h-16 items-center justify-end border-b bg-background px-4 sm:px-6"
      >
        <Link className={buttonVariants({ variant: 'outline' })} href={practiceExitHref(origin)}>
          <LogOut data-icon="inline-start" />
          Salir
        </Link>
      </nav>
      <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
        <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
          <RoadmapCanvasSession
            courseOffering={{
              identifier: { courseCode: PRACTICE_COURSE_CODE, ...term },
              title: PRACTICE_ROADMAP_TITLE,
            }}
            experience={{ kind: experience, term: 'current' }}
            practice={{
              nodeChangeCounts: experience === 'student' ? practiceNodeChangeCounts : {},
            }}
          />
        </RoadmapCanvasSessionPersistenceProvider>
      </main>
    </div>
  );
}
