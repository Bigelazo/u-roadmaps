import type { NextRequest } from 'next/server';
import { rejectCrossSiteMutation } from '@/app/_adapters/cross-site-mutation';

export function proxy(request: NextRequest) {
  return rejectCrossSiteMutation(request);
}

export const config = {
  matcher: '/api/:path*',
};
