import { NextResponse, type NextRequest } from 'next/server';
import { siteOrigin } from '@/shared/server/environment/site-url';
import { SAME_SITE_REQUEST_HEADER } from '@/shared/same-site-request';

const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const sameSiteFetches = new Set(['same-origin', 'none']);
const nativeFormPosts = new Set(['/api/logout', '/api/plogin/start']);

export function arrivesFromAnotherSite(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return !sameSiteFetches.has(fetchSite);
  const origin = request.headers.get('origin');
  return origin !== null && origin !== siteOrigin(request).origin;
}

function declaresApplicationRequest(request: NextRequest) {
  return (
    request.headers.has(SAME_SITE_REQUEST_HEADER) || nativeFormPosts.has(request.nextUrl.pathname)
  );
}

export function rejectCrossSiteMutation(request: NextRequest) {
  if (
    readMethods.has(request.method) ||
    (!arrivesFromAnotherSite(request) && declaresApplicationRequest(request))
  ) {
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
