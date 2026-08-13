import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getApplicationSession } from '@/lib/auth';

type Props = { searchParams: { error?: string } };

export default async function SignInPage({ searchParams }: Props) {
  if (await getApplicationSession()) redirect('/');
  const loginUrl = process.env.NEXT_PUBLIC_VTI_LOGIN_URL;
  const error = searchParams.error
    ? 'No fue posible completar la autenticación institucional. Inténtalo nuevamente.'
    : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12 text-[#1a1a1a]">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-[0_2px_8px_rgba(26,26,26,0.08)] sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#024ad8]">
          U-roadmaps
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight">Acceso institucional</h1>
        <p className="mt-4 text-base leading-relaxed text-[#636363]">
          Ingresa con tu identidad de Universidad de Chile mediante U-Pasaporte / VTI.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-[#f9d4d2] bg-[#fff7f7] p-4 text-sm text-[#b3262b]"
          >
            {error}
          </p>
        )}
        {loginUrl ? (
          <a
            href={loginUrl}
            className="mt-8 flex min-h-11 items-center justify-center rounded bg-[#024ad8] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.04em] text-white transition hover:bg-[#0e3191]"
          >
            Autenticarse con U-Pasaporte / VTI
          </a>
        ) : (
          <p className="mt-8 rounded-lg border border-[#f9d4d2] bg-[#fff7f7] p-4 text-sm text-[#b3262b]">
            El acceso institucional no está configurado.
          </p>
        )}
        <Link href="/" className="mt-6 block text-center text-sm font-medium text-[#024ad8]">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
