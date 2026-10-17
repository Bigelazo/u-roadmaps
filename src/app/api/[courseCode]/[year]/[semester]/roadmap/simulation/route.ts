import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readSimulatedRoadmap, resetSimulatedCompletions } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user }) =>
  NextResponse.json(await readSimulatedRoadmap({ userId: user.id, identifier })),
);

export const DELETE = courseRoute(async ({ identifier, user }) => {
  const result = await resetSimulatedCompletions({ userId: user.id, identifier });
  return NextResponse.json({ deletedCount: result.count });
});
