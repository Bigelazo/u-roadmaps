import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { isFramedRequest } from '@/app/_adapters/embedding';
import { SiteFooter } from '@/app/_components/SiteFooter';
import { StatusPage } from '@/app/_components/StatusPage';
import { buttonVariants } from '@/shared/ui/button-variants';

export const metadata: Metadata = { title: 'Página no encontrada | U-Roadmaps' };

export default async function NotFound() {
  const framed = isFramedRequest(await headers());
  return (
    <>
      <StatusPage
        eyebrow="Error 404"
        title="No encontramos esta página"
        description="La dirección no existe o el curso ya no está disponible. Revisa el enlace o vuelve a tus cursos para seguir tu ruta."
      >
        <Link href="/academic-overview" className={buttonVariants({ size: 'lg' })}>
          Ver mis cursos
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Ir al inicio
        </Link>
      </StatusPage>
      {framed ? null : <SiteFooter />}
    </>
  );
}
