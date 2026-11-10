import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { countOwnCourseOfferingNotices } from '@/features/notifications/server';

export const GET = courseRoute(async ({ identifier, user }) =>
  NextResponse.json(await countOwnCourseOfferingNotices(user.id, identifier)),
);
