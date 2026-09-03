export const vtiLoginStateCookieName = 'u-roadmaps-vti-state';
export const vtiLoginStateMaxAge = 10 * 60;

export function vtiLoginState(request: Request) {
  return request.headers
    .get('cookie')
    ?.match(new RegExp(`(?:^|;\\s*)${vtiLoginStateCookieName}=([^;]+)`))?.[1];
}
