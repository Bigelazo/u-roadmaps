import { NextResponse, type NextRequest } from 'next/server';
import { siteOrigin } from '@/shared/server/environment/site-url';

const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const sameSiteFetches = new Set(['same-origin', 'none']);

function arrivesFromAnotherSite(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return !sameSiteFetches.has(fetchSite);
  const origin = request.headers.get('origin');
  return origin !== null && origin !== siteOrigin(request).origin;
}

export function rejectCrossSiteMutation(request: NextRequest) {
  if (readMethods.has(request.method) || !arrivesFromAnotherSite(request)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error: {
        code: 'CROSS_SITE_REQUEST',
        message: 'La solicitud debe originarse en U-Roadmaps.',
      },
    },
    { status: 403 },
  );
}
