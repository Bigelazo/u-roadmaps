import 'server-only';

export { VtiAuthenticationError } from './server/errors';
export type { VtiIdentity } from './server/errors';
export { vtiLoginState, vtiLoginStateCookieName, vtiLoginStateMaxAge } from './server/cookies';

export async function startVtiLogin() {
  const { startVtiLogin: start } = await import('./server/protocol');
  return start();
}

export async function authenticateVtiCallback(
  request: Request,
  state: string | undefined,
  rawToken: FormDataEntryValue | null,
) {
  const { authenticateVtiCallback: authenticate } = await import('./server/protocol');
  return authenticate(request, state, rawToken);
}
