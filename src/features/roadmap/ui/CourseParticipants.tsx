import Link from 'next/link';
import { ArrowLeft, Route, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { buttonVariants } from '@/shared/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { dividedListClassName, PageEyebrow, PageShell, PageTitle } from '@/shared/ui/page-layout';
import { termLabel } from '@/shared/course-offering';
import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import type {
  CourseMember,
  CourseParticipants as Participants,
} from '@/features/roadmap/course-participants-types';

const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

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

/** Neutral track with a Jade fill; the value is always repeated as text beside it. */
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
    <section
      aria-labelledby="average-completion"
      className="grid gap-5 rounded-xl border border-fog bg-card px-5 py-6 sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="text-sm font-bold text-muted-foreground" id="average-completion">
            Completación promedio del roadmap
          </h2>
          <p className="mt-1 font-heading text-5xl font-semibold tracking-[-0.04em] text-ink">
            {average === null ? '—' : percent(average)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Solo estudiantes · {plural(studentCount, 'estudiante', 'estudiantes')}
        </p>
      </div>
      {average !== null ? (
        <ProgressTrack label="Completación promedio de estudiantes" ratio={average} />
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Nodos visibles</dt>
          <dd className="mt-0.5 font-semibold">{visibleNodes}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estudiantes que han ingresado</dt>
          <dd className="mt-0.5 font-semibold">
            {entered} de {studentCount}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cómo se calcula</dt>
          <dd className="mt-0.5">
            Nodos visibles completados sobre el total; quien no ha ingresado cuenta con 0%.
          </dd>
        </div>
      </dl>
    </section>
  );
}

function StudentRow({
  member,
  visibleNodes,
}: Readonly<{ member: CourseMember; visibleNodes: number }>) {
  const sections = sectionsLabel(member.sections);
  return (
    <li
      aria-label={member.name}
      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center sm:gap-6 sm:px-6"
    >
      <div className="min-w-0">
        <p className="font-semibold break-words">{member.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {sections ? <span>{sections}</span> : null}
          {member.institutionalPosition === 'OBSERVER' ? (
            <Badge variant="outline">Oyente · fuera del promedio</Badge>
          ) : null}
          {!member.hasEntered ? <Badge variant="secondary">Sin ingreso</Badge> : null}
        </div>
      </div>
      {member.completion !== null ? (
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-heading text-lg font-semibold text-ink">
              {percent(member.completion)}
            </span>
            <span className="text-muted-foreground">
              {member.completedNodes} de {visibleNodes} nodos
            </span>
          </div>
          <ProgressTrack label={`Completación de ${member.name}`} ratio={member.completion} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin nodos visibles</p>
      )}
    </li>
  );
}

function StaffRow({ member }: Readonly<{ member: CourseMember }>) {
  const sections = sectionsLabel(member.sections);
  return (
    <li
      aria-label={member.name}
      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6"
    >
      <p className="font-semibold break-words">{member.name}</p>
      <p className="text-sm text-muted-foreground">
        {member.institutionalPosition
          ? positionLabels[member.institutionalPosition]
          : 'Equipo docente'}
        {sections ? ` · ${sections}` : ''}
      </p>
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
          <PageEyebrow>
            {course.courseCode} · {termLabel(course)}
          </PageEyebrow>
          <PageTitle className="mt-2 md:text-5xl">Integrantes del curso</PageTitle>
          <p className="mt-2 text-muted-foreground">{course.name}</p>
        </div>
      </header>

      {participants.source === 'LOCAL' ? (
        <Alert>
          <AlertDescription>
            No pudimos obtener el listado completo desde U-Campus. Se muestran solo las personas que
            ya ingresaron a U-Roadmaps.
          </AlertDescription>
        </Alert>
      ) : null}

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

      <section aria-labelledby="students" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]" id="students">
            Estudiantes
          </h2>
          <p className="text-sm text-muted-foreground">
            {plural(students.length, 'persona', 'personas')}
          </p>
        </div>
        {students.length > 0 ? (
          <ul className={dividedListClassName}>
            {students.map((member) =>
              participants.hasRoadmap ? (
                <StudentRow
                  key={member.key}
                  member={member}
                  visibleNodes={participants.visibleNodes}
                />
              ) : (
                <StaffRow key={member.key} member={member} />
              ),
            )}
          </ul>
        ) : (
          <Empty className="border bg-card py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No hay estudiantes para mostrar</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section aria-labelledby="teaching-staff" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            className="font-heading text-2xl font-semibold tracking-[-0.02em]"
            id="teaching-staff"
          >
            Equipo docente
          </h2>
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
    </PageShell>
  );
}
