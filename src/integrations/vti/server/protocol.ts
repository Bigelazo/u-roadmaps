import 'server-only';

import { jwtVerify } from 'jose';
import { prisma } from '@/shared/server/db';
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

const vtiTokenMaxAge = 5 * 60;
const vtiClockTolerance = 30;
const reportedVtiClaims = ['iat', 'exp', 'nbf', 'jti', 'iss', 'aud', 'state', 'nonce'];

function isStale(issuedAt: unknown) {
  return (
    typeof issuedAt === 'number' &&
    Date.now() / 1000 - issuedAt > vtiTokenMaxAge + vtiClockTolerance
  );
}

function reportVtiClaimPresence(payload: Record<string, unknown>) {
  console.info(
    '[plogin] claims estándar del token VTI',
    Object.fromEntries(reportedVtiClaims.map((claim) => [claim, claim in payload])),
  );
}

export async function startVtiLogin() {
  const loginTarget = parseLoginUrl(process.env.NEXT_PUBLIC_VTI_LOGIN_URL);
  if (!loginTarget) return null;

  const state = crypto.randomUUID();
  await prisma.vtiLoginTransaction.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.vtiLoginTransaction.create({
    data: { state, expiresAt: new Date(Date.now() + vtiLoginStateMaxAge * 1000) },
  });
  loginTarget.searchParams.set('state', state);
  return { loginTarget, state };
}

export async function authenticateVtiCallback(
  state: string | undefined,
  rawToken: string | null,
): Promise<VtiIdentity> {
  if (!state) throw invalidCallback({ reason: 'missing-state-cookie' });

  const consumed = await prisma.vtiLoginTransaction.deleteMany({
    where: { state, expiresAt: { gt: new Date() } },
  });
  if (consumed.count !== 1) throw invalidCallback({ reason: 'unknown-or-expired-state' });
  if (!rawToken?.trim()) {
    throw invalidCallback({ reason: 'missing-token' });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(rawToken, vtiSecret(), {
      algorithms: ['HS256'],
      clockTolerance: vtiClockTolerance,
    }));
  } catch (error) {
    if (error instanceof VtiAuthenticationError) throw error;
    throw invalidCallback({ reason: 'invalid-token-signature' });
  }
  if (isStale(payload.iat)) throw invalidCallback({ reason: 'stale-token' });
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

  reportVtiClaimPresence(payload);
  return {
    rut,
    institutionalEmail,
    name,
  };
}
