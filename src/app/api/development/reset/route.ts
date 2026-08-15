import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/roadmap-api';
import { resetDevelopmentData } from '../../../../../prisma/development-data';
import { developmentEnvironmentEnabled } from '@/lib/development';

export async function POST() {
  try {
    if (!developmentEnvironmentEnabled()) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' } },
        { status: 404 },
      );
    }
    await resetDevelopmentData();
    return NextResponse.json({ reset: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
