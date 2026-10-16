'use client';

import { useState } from 'react';
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
import { studentTutorialSteps } from '@/features/roadmap/practice/student-tutorial';
import { teachingTutorialSteps } from '@/features/roadmap/practice/teaching-tutorial';
import { reportingPracticeActions } from '@/features/roadmap/practice/practice-actions';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { createTutorialActions, RoadmapTutorial } from '@/shared/client/tutorial/tutorial';
import { useRecordTutorialOpening } from '@/shared/client/tutorial/tutorial-records';

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
  useRecordTutorialOpening(experience);
  const [actions] = useState(() => createTutorialActions<PracticeCanvasAction>());
  const [teachingSteps] = useState(() =>
    experience === 'teaching' ? teachingTutorialSteps() : [],
  );
  const [persistence] = useState(() =>
    reportingPracticeActions(
      createInMemoryRoadmapSessionPersistence(
        practiceRoadmap(term, today),
        experience === 'student' ? { studentProgress: practiceStudentProgress } : {},
      ),
      actions.report,
    ),
  );
  return (
    <div data-practice-roadmap className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <main className="min-h-0 flex-1 bg-cloud">
        <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
          <RoadmapCanvasSession
            courseOffering={{
              identifier: { courseCode: PRACTICE_COURSE_CODE, ...term },
              title: PRACTICE_ROADMAP_TITLE,
            }}
            experience={{ kind: experience, term: 'current' }}
            practice={{
              exitHref: practiceExitHref(origin),
              nodeChangeCounts: experience === 'student' ? practiceNodeChangeCounts : {},
              onAction: actions.report,
            }}
          />
        </RoadmapCanvasSessionPersistenceProvider>
      </main>
      {experience === 'student' ? (
        <RoadmapTutorial steps={studentTutorialSteps} />
      ) : (
        <RoadmapTutorial steps={teachingSteps} actions={actions} />
      )}
    </div>
  );
}
