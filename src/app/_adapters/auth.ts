import { throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser as requireSessionUser } from '@/shared/server/session';

export function requireAuthenticatedUser() {
  return requireSessionUser().match((value) => value, throwApplicationError);
}
