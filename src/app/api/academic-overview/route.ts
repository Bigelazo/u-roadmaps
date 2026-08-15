import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { handleApiResult, throwApiError } from '@/lib/roadmap-api';

export async function GET() {
  return handleApiResult(async () => {
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const participations = await prisma.participation.findMany({
      where: { userId: user.id, isActive: true },
      include: { courseOffering: { include: { course: true, roadmap: true } } },
      orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
    });
    return NextResponse.json({
      offerings: participations.map(({ role, courseOffering }) => ({
        courseCode: courseOffering.course.code,
        name: courseOffering.course.name,
        department: courseOffering.course.department,
        year: courseOffering.year,
        semester: courseOffering.semester,
        role,
        hasRoadmap: Boolean(courseOffering.roadmap),
      })),
    });
  });
}
