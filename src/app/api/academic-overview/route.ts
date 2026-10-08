import { NextResponse } from 'next/server';
import { getAcademicOverviewApi } from '@/app/_adapters/academic-overview';
import { handleApplicationResult } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';

export async function GET() {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await getAcademicOverviewApi(user));
  });
}
