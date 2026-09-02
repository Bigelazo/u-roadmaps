import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/shared/server/db';
import { isDevelopmentPersona } from '@/lib/development';
import { getMufasaAcademicCourses } from '@/lib/mufasa';
import { handleApiResult, throwApiError } from '@/lib/roadmap-api';

export async function GET() {
  return handleApiResult(async () => {
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const [mufasa, participations] = await Promise.all([
      getMufasaAcademicCourses(user.rut, { useLocalFixtureData: isDevelopmentPersona(user.id) }),
      prisma.participation.findMany({
        where: { userId: user.id, isActive: true },
        include: { courseOffering: { include: { course: true, roadmap: true } } },
        orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
      }),
    ]);
    const localOfferings = new Map(
      participations.map(({ role, courseOffering }) => [
        `${courseOffering.course.code}:${courseOffering.year}:${courseOffering.semester}`,
        { role, courseOffering },
      ]),
    );
    const offerings =
      mufasa.source === 'MUFASA'
        ? mufasa.courses.map((course) => {
            const local = localOfferings.get(
              `${course.courseCode}:${course.year}:${course.semester}`,
            );
            return {
              courseCode: course.courseCode,
              name: course.name,
              year: course.year,
              semester: course.semester,
              section: course.section,
              department: local?.courseOffering.course.department ?? null,
              role:
                course.isTeaching ||
                (course.institutionalPosition !== null &&
                  course.institutionalPosition !== 'OBSERVER')
                  ? 'TEACHER'
                  : (local?.role ?? 'STUDENT'),
              institutionalPosition: course.institutionalPosition,
              hasRoadmap: Boolean(local?.courseOffering.roadmap),
            };
          })
        : participations.map(({ role, courseOffering }) => ({
            courseCode: courseOffering.course.code,
            name: courseOffering.course.name,
            department: courseOffering.course.department,
            year: courseOffering.year,
            semester: courseOffering.semester,
            section: null,
            role,
            institutionalPosition: null,
            hasRoadmap: Boolean(courseOffering.roadmap),
          }));
    return NextResponse.json({
      source: mufasa.source,
      offerings,
    });
  });
}
