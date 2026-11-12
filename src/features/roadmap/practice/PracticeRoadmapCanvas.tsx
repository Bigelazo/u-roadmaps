'use client';

import { useMemo, useState } from 'react';
import { RoadmapCanvasSession } from '@/features/roadmap/session/RoadmapCanvasSession';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import {
  PRACTICE_COURSE_CODE,
  PRACTICE_ROADMAP_TITLE,
  practiceCreatedNodePosition,
  practiceExitHref,
  practiceNodeChangeCounts,
  practiceRoadmap,
  practiceStudentProgress,
  type PracticeAcademicTerm,
  type PracticeExperience,
} from '@/features/roadmap/practice/practice-roadmap';
import { studentTutorialSteps } from '@/features/roadmap/practice/student-tutorial';
import { teachingTutorialSteps } from '@/features/roadmap/practice/teaching-tutorial';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { RoadmapTutorial } from '@/shared/client/tutorial/tutorial';
import { createTutorialActions } from '@/shared/client/tutorial/tutorial-support';
import { useRecordTutorialOpening } from '@/shared/client/tutorial/tutorial-records';

export function PracticeRoadmapCanvas({
  experience,
  term,
  today,
  origin,
  isAuthenticated,
}: {
  experience: PracticeExperience;
  term: PracticeAcademicTerm;
  today: string;
  origin: string | null;
  isAuthenticated: boolean;
}) {
  useRecordTutorialOpening(experience, isAuthenticated);
  const studentSteps = useMemo(() => studentTutorialSteps(isAuthenticated), [isAuthenticated]);
  const [actions] = useState(() => createTutorialActions<PracticeCanvasAction>());
  const [teachingSteps] = useState(() =>
    experience === 'teaching' ? teachingTutorialSteps() : [],
  );
  const [persistence] = useState(() =>
    createInMemoryRoadmapSessionPersistence(
      practiceRoadmap(term, today),
      experience === 'student'
        ? { studentProgress: practiceStudentProgress }
        : { createdNodePosition: practiceCreatedNodePosition },
    ),
  );
  return (
    <div data-practice-roadmap data-viewport-page className="flex min-h-0 flex-1 flex-col">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-cloud">
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
        <RoadmapTutorial steps={studentSteps} />
      ) : (
        <RoadmapTutorial steps={teachingSteps} actions={actions} />
      )}
    </div>
  );
}
