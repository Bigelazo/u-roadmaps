import { startInstitutionalLogin } from '@/features/institutional-access/server';

// Las rutas protegidas y la página `signIn` de NextAuth llegan por GET; ambas
// deben iniciar el mismo flujo institucional que el botón de acceso.
export async function GET(request: Request) {
  return startInstitutionalLogin(request);
}

export async function POST(request: Request) {
  return startInstitutionalLogin(request);
}
