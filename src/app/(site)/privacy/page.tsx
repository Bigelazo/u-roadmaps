import type { Metadata } from 'next';
import type * as React from 'react';
import { PageShell, PageTitle } from '@/shared/ui/page-layout';

export const metadata: Metadata = { title: 'Aviso de privacidad | U-Roadmaps' };

const lastUpdated = '16 de noviembre de 2026';

function PrivacySection({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id} className="px-5 py-6 sm:px-8 sm:py-7">
      <h2 id={id} className="font-heading text-[1.375rem] leading-tight font-semibold">
        {title}
      </h2>
      <div className="mt-4 max-w-[65ch] space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

function PrivacyList({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-graphite">{children}</ul>;
}

export default function PrivacyNoticePage() {
  return (
    <PageShell className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <PageTitle className="text-balance">Aviso de privacidad</PageTitle>
      <div className="mt-5 max-w-[65ch] space-y-4 text-lg leading-relaxed text-graphite">
        <p>
          U-Roadmaps es una herramienta de la Universidad de Chile, creada por Daniel Ramírez López,
          para seguir los contenidos de cada curso. Este aviso explica qué datos personales trata,
          de dónde vienen, para qué se usan, cuánto tiempo se conservan y cómo ejercer tus derechos
          según la Ley 21.719 sobre protección de datos personales.
        </p>
        <p className="text-base">Última actualización: {lastUpdated}.</p>
      </div>

      <div className="mt-10 divide-y divide-fog overflow-hidden rounded-xl border border-fog bg-card">
        <PrivacySection id="data-heading" title="Qué datos tratamos">
          <PrivacyList>
            <li>
              <strong>Identificación:</strong> tu nombre, tu correo institucional y tu RUT.
            </li>
            <li>
              <strong>Cursos:</strong> los cursos en que participas, su período académico y tu cargo
              en cada uno (por ejemplo, estudiante, profesor de cátedra, auxiliar, ayudante u
              observador).
            </li>
            <li>
              <strong>Avance:</strong> los contenidos que marcas como completados y cuándo, los
              recursos que abres, cuántas veces y si los revisaste.
            </li>
            <li>
              <strong>Avisos:</strong> los cambios del curso que te notificamos y cuándo los
              revisaste.
            </li>
            <li>
              <strong>Contenido docente:</strong> las rutas, los recursos y los archivos que el
              equipo docente publica, junto con quién creó cada ruta.
            </li>
            <li>
              <strong>Reportes de problemas:</strong> el nombre, el correo, el asunto y la
              descripción que escribes, más la página y la versión desde donde reportas.
            </li>
            <li>
              <strong>Datos técnicos:</strong> una cookie de sesión, una cookie temporal para el
              inicio de sesión y una cookie con tu tema de color. Tu navegador guarda además
              preferencias de la interfaz, una copia de tu lista de cursos y, mientras la pestaña
              siga abierta, tu historial de navegación dentro del sitio.
            </li>
          </PrivacyList>
          <p>
            No usamos herramientas de analítica ni publicidad, y no tratamos notas ni
            calificaciones.
          </p>
        </PrivacySection>

        <PrivacySection id="sources-heading" title="De dónde provienen">
          <PrivacyList>
            <li>
              <strong>U-Pasaporte</strong> entrega tu nombre, tu correo institucional y tu RUT al
              iniciar sesión.
            </li>
            <li>
              <strong>U-Campus</strong> informa tus cursos y cargos, y la nómina con los nombres de
              los integrantes de cada curso.
            </li>
            <li>
              <strong>Tú</strong> generas el avance, las revisiones de avisos y los reportes de
              problemas.
            </li>
            <li>
              <strong>El equipo docente</strong> publica las rutas y sus recursos.
            </li>
          </PrivacyList>
        </PrivacySection>

        <PrivacySection id="purpose-heading" title="Para qué los usamos">
          <PrivacyList>
            <li>Identificarte y mantener tu sesión abierta.</li>
            <li>Mostrarte tus cursos y la ruta de cada uno según tu cargo.</li>
            <li>Guardar tu avance para que retomes donde quedaste.</li>
            <li>
              Mostrar al equipo docente de cada curso el avance de sus estudiantes, para orientar la
              enseñanza.
            </li>
            <li>Avisarte cuando cambia la ruta de un curso en que participas.</li>
            <li>Responder los problemas que reportas.</li>
          </PrivacyList>
          <p>
            No vendemos tus datos ni los usamos para evaluarte. Para consultar tus cursos y los
            nombres de sus integrantes, enviamos tu RUT a U-Campus; los reportes de problemas se
            envían por correo electrónico a quien mantiene el servicio, a través de su proveedor de
            correo.
          </p>
        </PrivacySection>

        <PrivacySection id="retention-heading" title="Cuánto tiempo los conservamos">
          <PrivacyList>
            <li>
              Tu cuenta, tus participaciones y tu avance se conservan mientras el servicio funcione,
              para que puedas revisar las rutas de períodos anteriores. Puedes pedir su eliminación
              en cualquier momento.
            </li>
            <li>
              La cookie de sesión dura hasta 30 días; la de inicio de sesión, 10 minutos; la del
              tema de color, un año.
            </li>
            <li>La información consultada a U-Campus se guarda en memoria hasta por 24 horas.</li>
            <li>El registro de cuándo abriste los avisos de un curso se borra a las 24 horas.</li>
            <li>
              Los reportes de problemas quedan en el buzón de correo de quien mantiene el servicio
              hasta que pidas eliminarlos.
            </li>
            <li>
              Las preferencias y la copia de tu lista de cursos permanecen en tu navegador hasta que
              borres los datos del sitio.
            </li>
          </PrivacyList>
        </PrivacySection>

        <PrivacySection id="rights-heading" title="Tus derechos">
          <p>
            Puedes pedir acceso a tus datos, su rectificación, su supresión o su portabilidad,
            oponerte a un tratamiento y solicitar su bloqueo temporal. Si no quedas conforme con la
            respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales.
          </p>
        </PrivacySection>

        <PrivacySection id="contact-heading" title="Contacto">
          <p>
            Para ejercer tus derechos o consultar sobre este aviso, usa{' '}
            <strong>Reportar un problema</strong> en el pie de esta página, con el asunto
            «Privacidad». Indica qué derecho quieres ejercer; respondemos dentro del plazo legal.
          </p>
        </PrivacySection>
      </div>
    </PageShell>
  );
}
