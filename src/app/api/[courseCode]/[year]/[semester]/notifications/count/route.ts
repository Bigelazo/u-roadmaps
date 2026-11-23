import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { countOwnCourseOfferingNotices } from '@/features/notifications/server';

export const GET = courseRoute(async ({ actor }) =>
  NextResponse.json(await countOwnCourseOfferingNotices(actor.userId, actor.identifier)),
);
