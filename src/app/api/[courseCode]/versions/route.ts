import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { requireCourseCode } from '@/app/_adapters/roadmap';
import { readRoadmapVersionHistory } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const GET = courseRoute(
  async ({ identifier: courseCode, user }) =>
    NextResponse.json(await unwrap(() => readRoadmapVersionHistory(user, courseCode))),
  { identify: (params: Record<string, string>) => requireCourseCode(params.courseCode) },
);
