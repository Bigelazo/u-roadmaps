import { endInstitutionalSession } from '@/features/institutional-access/server';

export async function POST(request: Request) {
  return endInstitutionalSession(request);
}
