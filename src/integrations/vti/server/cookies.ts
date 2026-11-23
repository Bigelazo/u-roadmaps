import type { NextResponse } from 'next/server';
import { isHttps } from '@/shared/server/environment/site-url';

const httpsVtiLoginStateCookieName = '__Host-u-roadmaps-vti-state';
const httpVtiLoginStateCookieName = 'u-roadmaps-vti-state';
export const vtiLoginStateCookieNames = [httpsVtiLoginStateCookieName, httpVtiLoginStateCookieName];
export const vtiLoginStateMaxAge = 10 * 60;

export function vtiLoginStateCookie(request: Request) {
  const secure = isHttps(request);
  return {
    name: secure ? httpsVtiLoginStateCookieName : httpVtiLoginStateCookieName,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: vtiLoginStateMaxAge,
  };
}

export function vtiLoginState(request: Request) {
  const { name } = vtiLoginStateCookie(request);
  return request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
}

export function forgetVtiLoginState(response: NextResponse, request: Request) {
  response.cookies.set({ ...vtiLoginStateCookie(request), value: '', maxAge: 0 });
}
