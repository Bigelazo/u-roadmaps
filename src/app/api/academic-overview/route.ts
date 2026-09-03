import { NextResponse } from 'next/server';
import { getAcademicOverviewApi } from '@/features/academic-overview/server';
import { requireAuthenticatedUser } from '@/shared/server/session';
import {
  handleApplicationResult as handleApiResult,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';

export async function GET() {
  return handleApiResult(async () => {
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    return NextResponse.json(await getAcademicOverviewApi(user));
  });
}
