import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { requireCourseCode } from '@/app/_adapters/roadmap';
import { readRoadmapVersionHistory } from '@/features/roadmap/server';

export const GET = courseRoute(
  async ({ actor, user }) =>
    NextResponse.json(await readRoadmapVersionHistory(user, actor.identifier)),
  { identify: (params: Record<string, string>) => requireCourseCode(params.courseCode) },
);
