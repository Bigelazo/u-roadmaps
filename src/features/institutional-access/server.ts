import 'server-only';

export { endInstitutionalSession } from './application/logout';

export async function startInstitutionalLogin(request: Request) {
  const { startInstitutionalLogin: start } = await import('./application/login');
  return start(request);
}

export async function completeInstitutionalLogin(
  request: Request,
  rawToken: FormDataEntryValue | null,
) {
  const { completeInstitutionalLogin: complete } = await import('./application/login');
  return complete(request, rawToken);
}

export async function unreadableInstitutionalCallback(request: Request) {
  const { unreadableInstitutionalCallback: reject } = await import('./application/login');
  return reject(request);
}
