import { NextResponse } from 'next/server';
import { handleApiResult } from '@/lib/roadmap-api';
import { resetDevelopmentData } from '../../../../../prisma/development-data';
import { developmentEnvironmentEnabled } from '@/lib/development';

export async function POST() {
  return handleApiResult(async () => {
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
