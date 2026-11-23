import 'server-only';

export { VtiAuthenticationError } from './server/errors';
export type { VtiIdentity } from './server/errors';
export {
  forgetVtiLoginState,
  vtiLoginState,
  vtiLoginStateCookie,
  vtiLoginStateCookieNames,
} from './server/cookies';

export async function startVtiLogin() {
  const { startVtiLogin: start } = await import('./server/protocol');
  return start();
}

export async function authenticateVtiCallback(state: string | undefined, rawToken: string | null) {
  const { authenticateVtiCallback: authenticate } = await import('./server/protocol');
  return authenticate(state, rawToken);
}
