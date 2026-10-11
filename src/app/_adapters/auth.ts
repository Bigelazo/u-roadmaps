import { unwrap } from '@/shared/errors/server';
import { requireAuthenticatedUser as requireSessionUser } from '@/shared/server/session';

export function requireAuthenticatedUser() {
  return unwrap(() => requireSessionUser());
}
