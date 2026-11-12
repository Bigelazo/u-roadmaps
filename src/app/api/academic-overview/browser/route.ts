import { NextResponse } from 'next/server';
import { getAcademicOverviewBrowser } from '@/app/_adapters/academic-overview';
import { handleApplicationResult } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';

function overviewResponse(synchronize: boolean) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await getAcademicOverviewBrowser(user, synchronize), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
}

export async function GET() {
  return overviewResponse(false);
}

export async function POST() {
  return overviewResponse(true);
}
