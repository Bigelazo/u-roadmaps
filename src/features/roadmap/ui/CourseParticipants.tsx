import { Route } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { PageShell } from '@/shared/ui/page-layout';
import { termLabel } from '@/shared/course-offering';
import type { CourseParticipants as Participants } from '@/features/roadmap/course-participants-types';

import { CoursePageHeader } from './CoursePageHeader';
import { StudentRoster } from './StudentRoster';
import { StaffByPosition } from './StaffByPosition';

function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function ProgressTrack({ ratio, label }: Readonly<{ ratio: number; label: string }>) {
  const value = Math.round(ratio * 100);
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-fog"
      role="progressbar"
    >
      <div className="h-full rounded-full bg-progress" style={{ width: `${value}%` }} />
    </div>
  );
}

function AverageCompletion({ participants }: Readonly<{ participants: Participants }>) {
  const { averageStudentCompletion: average, studentCount, visibleNodes } = participants;
  const entered = participants.students.filter(
    (member) => member.institutionalPosition === 'STUDENT' && member.hasEntered,
  ).length;
  return (
    <section aria-labelledby="average-completion" className="grid gap-4 border-y border-fog py-5">
      <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center">
        <div>
          <h4 className="text-sm text-muted-foreground" id="average-completion">
            Completación promedio del roadmap
          </h4>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {average === null ? '—' : percent(average)}
            </span>
            {average !== null ? (
              <ProgressTrack label="Completación promedio de estudiantes" ratio={average} />
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-5 sm:col-span-2">
          <div className="row-span-2 grid grid-rows-subgrid gap-y-1">
            <dt className="self-end text-sm text-muted-foreground">
              Estudiantes que han ingresado
            </dt>
            <dd className="font-semibold tabular-nums">
              {entered} de {studentCount}
            </dd>
          </div>
          <div className="row-span-2 grid grid-rows-subgrid gap-y-1">
            <dt className="self-end text-sm text-muted-foreground">Nodos visibles</dt>
            <dd className="font-semibold tabular-nums">{visibleNodes}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Solo estudiantes · {plural(studentCount, 'estudiante', 'estudiantes')}. Nodos visibles
        completados sobre el total; quien no ha ingresado cuenta con 0%.
      </p>
    </section>
  );
}

export function CourseParticipants({ participants }: Readonly<{ participants: Participants }>) {
  const { course, students, teachingStaff } = participants;
  return (
    <PageShell className="mx-auto flex max-w-5xl flex-col gap-10 px-4 sm:px-6">
      <CoursePageHeader
        courseName={course.name}
        courseCode={course.courseCode}
        courseDetail={`${course.courseCode} · ${termLabel(course)}`}
        offering={course}
        current="participants"
        section="Integrantes del curso"
        fallbackHref={
          participants.hasRoadmap
            ? `/courses/${encodeURIComponent(course.courseCode)}/${course.year}/${course.semester}`
            : '/academic-overview'
        }
      />

      <section aria-labelledby="teaching-staff" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]" id="teaching-staff">
            Equipo docente
          </h3>
          <p className="text-sm text-muted-foreground">
            {plural(teachingStaff.length, 'persona', 'personas')}
          </p>
        </div>
        <StaffByPosition
          layout="card"
          staff={teachingStaff}
          memberKey={(member) => member.key}
          bySection
        />
      </section>

      <section aria-labelledby="students" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]" id="students">
            Estudiantes
          </h3>
        </div>
        {participants.hasRoadmap ? (
          <AverageCompletion participants={participants} />
        ) : (
          <Empty className="border bg-card py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Route aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Este curso todavía no tiene roadmap</EmptyTitle>
              <EmptyDescription>
                El avance de los estudiantes aparece aquí cuando el profesor de cátedra crea el
                roadmap.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <StudentRoster
          students={students}
          hasRoadmap={participants.hasRoadmap}
          visibleNodes={participants.visibleNodes}
        />
      </section>
    </PageShell>
  );
}
