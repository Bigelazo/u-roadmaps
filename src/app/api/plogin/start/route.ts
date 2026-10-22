import { startInstitutionalLogin } from '@/features/institutional-access/server';

export async function GET(request: Request) {
  return startInstitutionalLogin(request);
}

export async function POST(request: Request) {
  return startInstitutionalLogin(request);
}
