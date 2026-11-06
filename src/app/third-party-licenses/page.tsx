import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Licencias de terceros | U-Roadmaps' };

const linkClassName =
  'underline underline-offset-4 outline-none hover:text-primary-deep focus-visible:ring-3 focus-visible:ring-ring/50';

export default function ThirdPartyLicensesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Licencias de terceros</h1>
      <p className="mt-6 text-base">
        U-Roadmaps traza las dependencias del mapa con libavoid, una biblioteca cubierta por la GNU
        Lesser General Public License, versión 2.1 o posterior (LGPL-2.1-or-later).
      </p>
      <p className="mt-4">
        <a className={linkClassName} href="/vendor/libavoid/0.4.5/LICENSE">
          Leer el texto completo de la licencia
        </a>
      </p>
      <section aria-labelledby="libavoid-heading" className="mt-10">
        <h2 id="libavoid-heading" className="font-heading text-xl font-semibold">
          libavoid
        </h2>
        <p className="mt-2 text-base">Copyright (C) 2004-2014 Monash University.</p>
        <p className="mt-2 text-base">
          Motor compilado a WebAssembly, que se sirve sin modificar como un{' '}
          <a className={linkClassName} href="/vendor/libavoid/0.4.5/libavoid.wasm" download>
            archivo aparte
          </a>
          .{' '}
          <a className={linkClassName} href="https://github.com/Aksem/adaptagrams/tree/v1.0.4">
            Código fuente de esta versión
          </a>
          .
        </p>
      </section>
      <section aria-labelledby="libavoid-js-heading" className="mt-8">
        <h2 id="libavoid-js-heading" className="font-heading text-xl font-semibold">
          libavoid-js 0.4.5
        </h2>
        <p className="mt-2 text-base">Vladyslav Hnatiuk.</p>
        <p className="mt-2 text-base">
          Enlace de JavaScript al motor, incluido y minificado en el código de esta aplicación.{' '}
          <a className={linkClassName} href="https://github.com/Aksem/libavoid-js/tree/v0.4.5">
            Código fuente e instrucciones de compilación
          </a>
          .
        </p>
      </section>
    </main>
  );
}
