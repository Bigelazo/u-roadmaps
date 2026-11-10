import Link from 'next/link';
import { ArrowLeft, Route } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { dividedListClassName, PageShell, PageTitle } from '@/shared/ui/page-layout';
import { termLabel } from '@/shared/course-offering';
import { PositionPlate } from '@/shared/ui/position-plate';
import type {
  CourseMember,
  CourseParticipants as Participants,
} from '@/features/roadmap/course-participants-types';

import { StudentRoster } from './StudentRoster';

function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function sectionsLabel(sections: readonly string[]) {
  if (sections.length === 0) return null;
  return `${sections.length === 1 ? 'Sección' : 'Secciones'} ${sections.join(', ')}`;
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

function StaffRow({ member }: Readonly<{ member: CourseMember }>) {
  const sections = sectionsLabel(member.sections);
  return (
    <li
      aria-label={member.name}
      className="flex flex-col gap-y-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6 sm:px-5"
    >
      <p className="font-medium break-words">{member.name}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <PositionPlate position={member.institutionalPosition} />
        {sections ? <span> · {sections}</span> : null}
      </div>
    </li>
  );
}

export function CourseParticipants({ participants }: Readonly<{ participants: Participants }>) {
  const { course, students, teachingStaff } = participants;
  return (
    <PageShell className="mx-auto flex max-w-5xl flex-col gap-10 px-4 sm:px-6">
      <header className="grid gap-4">
        <Link
          className={buttonVariants({ variant: 'outline', className: 'justify-self-start' })}
          href={
            participants.hasRoadmap
              ? `/courses/${encodeURIComponent(course.courseCode)}/${course.year}/${course.semester}`
              : '/academic-overview'
          }
        >
          <ArrowLeft data-icon="inline-start" />
          {participants.hasRoadmap ? 'Volver al roadmap' : 'Volver al resumen académico'}
        </Link>
        <div>
          <PageTitle className="text-balance md:text-4xl">{course.name}</PageTitle>
          <p className="mt-2 text-muted-foreground">
            {course.courseCode} · {termLabel(course)}
          </p>
        </div>
      </header>

      <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
        Integrantes del curso
      </h2>

      {participants.source === 'LOCAL' ? (
        <Alert>
          <AlertDescription>
            No pudimos obtener el listado completo desde U-Campus. Se muestran solo las personas que
            ya ingresaron a U-Roadmaps.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="teaching-staff" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]" id="teaching-staff">
            Equipo docente
          </h3>
          <p className="text-sm text-muted-foreground">
            {plural(teachingStaff.length, 'persona', 'personas')}
          </p>
        </div>
        <ul className={dividedListClassName}>
          {teachingStaff.map((member) => (
            <StaffRow key={member.key} member={member} />
          ))}
        </ul>
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
