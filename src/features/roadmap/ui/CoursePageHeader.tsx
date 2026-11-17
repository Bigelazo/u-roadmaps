import Link from 'next/link';
import { History, Route, UserGroup, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { buttonVariants } from '@/shared/ui/button-variants';
import { PageTitle } from '@/shared/ui/page-layout';
import { courseParticipantsUrl } from '@/shared/course-offering';
import { versionHistoryUrl } from '@/shared/version-history-url';

type CourseSection = 'versions' | 'participants';
type Offering = Readonly<{ year: number; semester: number; hasRoadmap: boolean }>;

function CourseSectionLink({
  href,
  icon: Icon,
  isCurrent,
  children,
}: Readonly<{ href: string; icon: LucideIcon; isCurrent: boolean; children: string }>) {
  return (
    <Link
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'text-primary hover:bg-primary-soft/50 hover:text-primary-deep aria-[current=page]:bg-primary-soft/60 aria-[current=page]:text-primary-deep',
      )}
      href={href}
    >
      <Icon data-icon="inline-start" />
      {children}
    </Link>
  );
}

function CourseSections({
  courseCode,
  offering,
  current,
}: Readonly<{ courseCode: string; offering: Offering | null; current: CourseSection }>) {
  return (
    <nav aria-label="Secciones del curso" className="-ml-3 flex flex-wrap gap-1">
      {offering?.hasRoadmap ? (
        <CourseSectionLink
          href={`/courses/${encodeURIComponent(courseCode)}/${offering.year}/${offering.semester}`}
          icon={Route}
          isCurrent={false}
        >
          Roadmap
        </CourseSectionLink>
      ) : null}
      {offering ? (
        <CourseSectionLink
          href={courseParticipantsUrl({ courseCode, ...offering })}
          icon={UserGroup}
          isCurrent={current === 'participants'}
        >
          Integrantes
        </CourseSectionLink>
      ) : null}
      <CourseSectionLink
        href={versionHistoryUrl(courseCode)}
        icon={History}
        isCurrent={current === 'versions'}
      >
        Versiones
      </CourseSectionLink>
    </nav>
  );
}

export function CoursePageHeader({
  courseName,
  courseCode,
  courseDetail,
  academicWeek,
  offering,
  current,
  section,
}: Readonly<{
  courseName: string;
  courseCode: string;
  courseDetail: string;
  academicWeek?: string | null;
  offering: Offering | null;
  current: CourseSection;
  section: string;
}>) {
  return (
    <header className="grid gap-6">
      <div className="grid gap-4">
        <div>
          <PageTitle className="text-balance md:text-5xl">{courseName}</PageTitle>
          <p className="mt-2 text-muted-foreground">
            {[courseDetail, academicWeek].filter(Boolean).join(' · ')}
          </p>
        </div>
        <CourseSections courseCode={courseCode} offering={offering} current={current} />
      </div>
      <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">{section}</h2>
    </header>
  );
}
