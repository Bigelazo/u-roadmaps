import type { Metadata } from 'next';
import type * as React from 'react';
import { ArrowUpRight, Download, FileText } from 'lucide-react';
import { PageShell, PageTitle } from '@/shared/ui/page-layout';

export const metadata: Metadata = { title: 'Licencias de terceros | U-Roadmaps' };

const inlineLinkClassName =
  'rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 outline-none hover:text-primary-deep hover:decoration-primary-deep focus-visible:ring-3 focus-visible:ring-ring/50';

const actionLinkClassName =
  'inline-block rounded-md py-2.5 font-semibold text-primary underline decoration-primary/40 underline-offset-4 outline-none hover:text-primary-deep hover:decoration-primary-deep focus-visible:ring-3 focus-visible:ring-ring/50';

function ComponentNotice({
  id,
  name,
  credit,
  children,
}: Readonly<{ id: string; name: string; credit: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id} className="px-5 py-6 sm:px-8 sm:py-7">
      <h2 id={id} className="font-heading text-[1.375rem] leading-tight font-semibold">
        {name}
      </h2>
      <p className="mt-1 text-sm font-medium text-graphite">{credit}</p>
      <div className="mt-4 space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

export default function ThirdPartyLicensesPage() {
  return (
    <PageShell className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <PageTitle className="text-balance">Licencias de terceros</PageTitle>
      <div className="mt-5 max-w-[65ch] space-y-4 text-lg leading-relaxed text-graphite">
        <p>
          U-Roadmaps se distribuye bajo la licencia Apache-2.0; sus archivos LICENSE y NOTICE están
          en el{' '}
          <a className={inlineLinkClassName} href="https://github.com/Bigelazo/u-roadmaps">
            repositorio del proyecto
          </a>
          . Esta página reúne los componentes de terceros cuyas licencias exigen un aviso.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border border-fog bg-card">
        <div className="border-b border-fog px-5 py-6 sm:px-8 sm:py-7">
          <p className="max-w-[65ch] text-base leading-relaxed">
            U-Roadmaps traza las dependencias del mapa con libavoid, una biblioteca cubierta por la
            GNU Lesser General Public License, versión 2.1 o posterior{' '}
            <span className="font-semibold whitespace-nowrap">(LGPL-2.1-or-later)</span>.
          </p>
          <p className="mt-2">
            <a className={actionLinkClassName} href="/vendor/libavoid/0.4.5/LICENSE">
              <FileText aria-hidden className="mr-2 inline size-5 align-[-0.25em]" />
              Leer el texto completo de la licencia
            </a>
          </p>
        </div>

        <div className="divide-y divide-fog">
          <ComponentNotice
            id="libavoid-heading"
            name="libavoid"
            credit="Copyright (C) 2004-2014 Monash University."
          >
            <p className="max-w-[65ch]">
              Motor compilado a WebAssembly, que se sirve sin modificar como un{' '}
              <span className="whitespace-nowrap">
                <a
                  className={inlineLinkClassName}
                  href="/vendor/libavoid/0.4.5/libavoid.wasm"
                  download
                >
                  archivo aparte
                </a>
                <Download
                  aria-hidden
                  className="ml-1 inline size-4 align-[-0.125em] text-primary"
                />
                .
              </span>
            </p>
            <p>
              <a
                className={actionLinkClassName}
                href="https://github.com/Aksem/adaptagrams/tree/v1.0.4"
              >
                Código fuente de esta versión
                <ArrowUpRight aria-hidden className="ml-1 inline size-5 align-[-0.25em]" />
              </a>
            </p>
          </ComponentNotice>

          <ComponentNotice
            id="libavoid-js-heading"
            name="libavoid-js 0.4.5"
            credit="Vladyslav Hnatiuk."
          >
            <p className="max-w-[65ch]">
              Enlace de JavaScript al motor, incluido y minificado en el código de esta aplicación.
            </p>
            <p>
              <a
                className={actionLinkClassName}
                href="https://github.com/Aksem/libavoid-js/tree/v0.4.5"
              >
                Código fuente e instrucciones de compilación
                <ArrowUpRight aria-hidden className="ml-1 inline size-5 align-[-0.25em]" />
              </a>
            </p>
          </ComponentNotice>
        </div>
      </div>
    </PageShell>
  );
}
