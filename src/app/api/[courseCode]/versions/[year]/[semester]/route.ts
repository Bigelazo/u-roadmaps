import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readRoadmapVersion } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ actor, user }) =>
  NextResponse.json(await readRoadmapVersion(user, actor.identifier)),
);
