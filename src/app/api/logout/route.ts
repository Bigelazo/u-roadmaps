import { endInstitutionalSession } from '@/features/institutional-access/server';

export function POST(request: Request) {
  return endInstitutionalSession(request);
}
