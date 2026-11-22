import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readRoadmapChangeImpact } from '@/features/roadmap/server';

const CHANGE_FIELDS = [
  'kind',
  'nodeId',
  'operation',
  'sourceNodeId',
  'targetNodeId',
  'sourceHandle',
  'targetHandle',
];

export const GET = courseRoute(async ({ actor, request }) => {
  const query = new URL(request.url).searchParams;
  const input = Object.fromEntries(
    CHANGE_FIELDS.flatMap((field) => (query.has(field) ? [[field, query.get(field)]] : [])),
  );
  return NextResponse.json(await readRoadmapChangeImpact({ ...actor, input }));
});
