import { NextResponse } from 'next/server';
import { handleApplicationResult } from '@/app/_adapters/http';
import { resetDevelopmentData } from '@/development/server';
import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';

export async function POST() {
  return handleApplicationResult(async () => {
    if (!developmentEnvironmentEnabled()) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' } },
        { status: 404 },
      );
    }
    await resetDevelopmentData();
    return NextResponse.json({ reset: true });
  });
}
