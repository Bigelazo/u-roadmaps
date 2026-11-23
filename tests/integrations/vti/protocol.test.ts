// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SignJWT } from 'jose';
import { authenticateVtiCallback } from '@/integrations/vti/server/protocol';

vi.mock('@/shared/server/db', () => ({
  prisma: { vtiLoginTransaction: { deleteMany: vi.fn(async () => ({ count: 1 })) } },
}));

const secret = 'protocol-test-secret';
const identity = {
  identification: '000012345678-5',
  email: 'persona@uchile.cl',
  name: 'Persona Institucional',
};

function signedToken(issuedAt?: number) {
  const token = new SignJWT(identity).setProtectedHeader({ alg: 'HS256' });
  if (issuedAt !== undefined) token.setIssuedAt(issuedAt);
  return token.sign(new TextEncoder().encode(secret));
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

beforeEach(() => {
  vi.stubEnv('VTI_JWT_SECRET', secret);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('a token issued minutes ago is rejected as stale', async () => {
  const rejection = await authenticateVtiCallback(
    'state',
    await signedToken(nowInSeconds() - 10 * 60),
  ).catch((error: unknown) => error);

  expect(rejection).toMatchObject({
    code: 'INVALID_AUTH_CALLBACK',
    details: { reason: 'stale-token' },
  });
});

test('a freshly issued token authenticates the institutional identity', async () => {
  await expect(
    authenticateVtiCallback('state', await signedToken(nowInSeconds())),
  ).resolves.toMatchObject({ rut: '12345678', institutionalEmail: 'persona@uchile.cl' });
});

test('a token without an issue time is still accepted', async () => {
  await expect(authenticateVtiCallback('state', await signedToken())).resolves.toMatchObject({
    rut: '12345678',
  });
});

test('a successful login reports which standard claims the token carries without their values', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const issuedAt = nowInSeconds();

  await authenticateVtiCallback('state', await signedToken(issuedAt));

  expect(info).toHaveBeenCalledTimes(1);
  const [, presence] = info.mock.calls[0];
  expect(presence).toEqual({
    iat: true,
    exp: false,
    nbf: false,
    jti: false,
    iss: false,
    aud: false,
    state: false,
    nonce: false,
  });
  const logged = JSON.stringify(info.mock.calls);
  for (const value of [String(issuedAt), ...Object.values(identity), '12345678']) {
    expect(logged).not.toContain(value);
  }
});
