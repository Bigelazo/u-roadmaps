import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readRoadmapVersion } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const GET = courseRoute(async ({ identifier, user }) =>
  NextResponse.json(await unwrap(() => readRoadmapVersion(user, identifier))),
);
