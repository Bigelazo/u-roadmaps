import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readSimulatedRoadmap, resetSimulatedCompletions } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const GET = courseRoute(async ({ identifier, user }) =>
  NextResponse.json(await unwrap(() => readSimulatedRoadmap({ userId: user.id, identifier }))),
);

export const DELETE = courseRoute(async ({ identifier, user }) => {
  const result = await unwrap(() => resetSimulatedCompletions({ userId: user.id, identifier }));
  return NextResponse.json({ deletedCount: result.count });
});
