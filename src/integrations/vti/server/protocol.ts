import 'server-only';

import { jwtVerify } from 'jose';
import { prisma } from '@/shared/server/db';
import { siteOrigin } from '@/shared/server/environment/site-url';
import {
  invalidVtiClaims,
  normalizeInstitutionalEmail,
  parseVtiIdentification,
  requireVtiClaim,
} from './claims';
import { vtiLoginStateMaxAge } from './cookies';
import { VtiAuthenticationError, type VtiIdentity } from './errors';

function invalidCallback(details: Record<string, unknown>): VtiAuthenticationError {
  return new VtiAuthenticationError(
    400,
    'INVALID_AUTH_CALLBACK',
    'No fue posible completar la autenticación.',
    details,
  );
}

function vtiSecret() {
  const secret = process.env.VTI_JWT_SECRET;
  if (!secret) {
    throw new VtiAuthenticationError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticación institucional no está disponible.',
    );
  }
  return new TextEncoder().encode(secret);
}

function parseLoginUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCrossSiteCallback(request: Request) {
  const origin = request.headers.get('origin');
  return origin !== null && origin !== siteOrigin(request).origin;
}

/** Starts the one-time VTI callback transaction without creating an app session. */
export async function startVtiLogin() {
  const loginTarget = parseLoginUrl(process.env.NEXT_PUBLIC_VTI_LOGIN_URL);
  if (!loginTarget) return null;

  const state = crypto.randomUUID();
  await prisma.vtiLoginTransaction.create({
    data: { state, expiresAt: new Date(Date.now() + vtiLoginStateMaxAge * 1000) },
  });
  loginTarget.searchParams.set('state', state);
  return { loginTarget, state };
}

/**
 * Validates the VTI callback and returns institutional identity only. It never
 * creates a local User, session, Participation, or Participation role.
 */
export async function authenticateVtiCallback(
  request: Request,
  state: string | undefined,
  rawToken: FormDataEntryValue | null,
): Promise<VtiIdentity> {
  if (request.method === 'POST' && isCrossSiteCallback(request)) {
    throw new VtiAuthenticationError(
      403,
      'INVALID_AUTH_CALLBACK',
      'No fue posible completar la autenticación.',
      {
        reason: 'cross-site-origin',
        origin: request.headers.get('origin'),
        expected: siteOrigin(request).origin,
      },
    );
  }
  if (!state) throw invalidCallback({ reason: 'missing-state-cookie' });

  const consumed = await prisma.vtiLoginTransaction.deleteMany({
    where: { state, expiresAt: { gt: new Date() } },
  });
  if (consumed.count !== 1) throw invalidCallback({ reason: 'unknown-or-expired-state' });
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    throw invalidCallback({ reason: 'missing-token' });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(rawToken, vtiSecret(), { algorithms: ['HS256'] }));
  } catch (error) {
    if (error instanceof VtiAuthenticationError) throw error;
    throw invalidCallback({ reason: 'invalid-token-signature' });
  }
  const invalidClaimsError = (claim: string): never => {
    throw new VtiAuthenticationError(
      400,
      invalidVtiClaims,
      'No fue posible validar la identidad institucional.',
      { reason: 'invalid-claim', claim },
    );
  };
  const rut = parseVtiIdentification(payload.identification).match(
    (value) => value,
    () => invalidClaimsError('identification'),
  );
  const institutionalEmail = normalizeInstitutionalEmail(payload.email).match(
    (value) => value,
    () => invalidClaimsError('email'),
  );
  const name = requireVtiClaim(payload.name).match(
    (value) => value,
    () => invalidClaimsError('name'),
  );

  return {
    rut,
    institutionalEmail,
    name,
    preferredUsername:
      typeof payload.preferred_username === 'string'
        ? payload.preferred_username.trim().slice(0, 320)
        : undefined,
  };
}
