import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  ensureTypeNameAvailable,
  getAvailableTypes,
  normalizeName,
  parseCourseOfferingIdentifier,
  parseJson,
  requireColor,
  requireRoadmap,
  requireString,
} from '@/lib/roadmap-api';
import { requireCourseOfferingParticipation, requireCourseOfferingTeacher } from '@/lib/auth';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingParticipation(identifier, ['STUDENT', 'TEACHER']);
    const roadmap = await requireRoadmap(identifier);
    return NextResponse.json({ nodeTypes: await getAvailableTypes(roadmap.id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const body = await parseJson(request);
    const name = requireString(body.name, 'name', 120);
    const color = requireColor(body.color);
    await ensureTypeNameAvailable(name, roadmap.id);
    const nodeType = await prisma.nodeType.create({
      data: {
        roadmapId: roadmap.id,
        name,
        normalizedName: normalizeName(name),
        color,
        isPredefined: false,
      },
    });
    return NextResponse.json(
      {
        nodeType: {
          id: nodeType.id,
          name: nodeType.name,
          color: nodeType.color,
          isPredefined: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
