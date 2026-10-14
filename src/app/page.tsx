import { redirect } from 'next/navigation';
import { CourseRouteComparison } from '@/app/_components/landing/CourseRouteComparison';
import { InstitutionalLoginForm } from '@/app/_components/InstitutionalLoginForm';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

const audienceLanes = [
  {
    id: 'teaching-staff',
    title: 'Para equipos docentes',
    lead: 'Ordena el curso como se estudia y decide cuándo se abre cada parte.',
    items: [
      {
        title: 'Arma la ruta del curso',
        description:
          'Crea nodos de contenido, evaluación y material extra, y conéctalos según lo que requiere cada uno.',
      },
      {
        title: 'Decide cuándo se abre cada parte',
        description:
          'Bloquea un nodo o programa su desbloqueo para una fecha; tus estudiantes ven qué falta y desde cuándo.',
      },
      {
        title: 'Sigue el avance de tu curso',
        description:
          'Revisa cuánto de la ruta completó cada estudiante y el promedio del curso, con el listado de U-Campus.',
      },
      {
        title: 'Cada semestre queda registrado',
        description:
          'Al terminar el semestre, la ruta queda como una versión de solo lectura en el historial del curso.',
      },
    ],
  },
  {
    id: 'students',
    title: 'Para estudiantes',
    lead: 'Sabes qué puedes abrir, qué necesitas antes y qué ya completaste.',
    items: [
      {
        title: 'Sabes qué puedes abrir',
        description:
          'Cada nodo indica si está disponible, completado o bloqueado, y qué debes completar antes.',
      },
      {
        title: 'Los recursos están donde los necesitas',
        description: 'Archivos, enlaces y videos viven dentro del nodo al que pertenecen.',
      },
      {
        title: 'Tu avance queda registrado',
        description: 'Marca cada nodo al completarlo; el registro se conserva con su fecha.',
      },
      {
        title: 'Te enteras de los cambios',
        description:
          'Si el equipo docente modifica la ruta, recibes un aviso y un resumen al volver a entrar.',
      },
    ],
  },
] as const;

const startSteps = [
  {
    title: 'Ingresa con U-Pasaporte',
    description: 'Usa tu cuenta institucional; no hay un registro aparte.',
  },
  {
    title: 'Encuentra tus cursos',
    description:
      'Tu resumen académico reúne tus cursos de U-Campus, actuales y anteriores, con tu cargo en cada uno.',
  },
  {
    title: 'Abre la ruta del curso',
    description: 'Si el curso aún no tiene ruta, quien dicta la cátedra puede crearla desde ahí.',
  },
] as const;

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <>
      <main className="bg-cloud text-foreground">
        <section
          aria-labelledby="landing-title"
          className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 md:pt-10"
        >
          <div className="rounded-xl bg-ink px-6 py-10 text-primary-foreground sm:px-10 md:py-12 xl:grid xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-center xl:gap-10 xl:px-12">
            <div className="max-w-xl">
              <h1
                id="landing-title"
                className="font-heading text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-5xl xl:text-[3.5rem] xl:tracking-[-0.05em]"
              >
                Cada curso, una ruta clara.
              </h1>
              <p className="mt-6 text-lg leading-[1.55] text-pretty text-primary-foreground/85">
                Explora contenidos, requisitos y recursos en una ruta que muestra tu avance.
              </p>
              <InstitutionalLoginForm tone="dark" className="mt-8" />
              <p className="mt-4 text-sm leading-normal text-primary-soft">
                Usa tu cuenta U-Pasaporte. Tus cursos se cargan desde{' '}
                <span className="whitespace-nowrap">U-Campus</span>.
              </p>
            </div>
            <CourseRouteComparison className="mt-14 xl:mt-0" />
          </div>
        </section>

        <section
          aria-label="Qué cambia para cada persona"
          className="mx-auto grid max-w-[1440px] gap-16 px-4 py-20 sm:px-6 md:grid-cols-2 md:gap-12 md:py-28 lg:gap-20 lg:px-12"
        >
          {audienceLanes.map((lane) => (
            <div key={lane.id} aria-labelledby={`${lane.id}-title`} role="group">
              <h2
                id={`${lane.id}-title`}
                className="font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em]"
              >
                {lane.title}
              </h2>
              <p className="mt-3 max-w-[38ch] text-lg leading-[1.55] text-graphite">{lane.lead}</p>
              <ul className="mt-8">
                {lane.items.map((item) => (
                  <li key={item.title} className="border-t border-fog py-5">
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="mt-1 max-w-[52ch] leading-normal text-graphite">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="start-title" className="border-t border-fog bg-card">
          <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 md:py-24 lg:px-12">
            <h2
              id="start-title"
              className="font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em]"
            >
              Cómo empiezas
            </h2>
            <ol className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-[7px] w-px bg-primary md:top-[7px] md:right-[calc(100%/3-1.75rem)] md:bottom-auto md:left-2 md:h-px md:w-auto"
              />
              {startSteps.map((step) => (
                <li key={step.title} className="relative pl-10 md:pt-10 md:pl-0">
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 left-0 size-4 rounded-full border-4 border-card bg-primary ring-1 ring-primary md:top-0"
                  />
                  <p className="font-heading text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.02em]">
                    {step.title}
                  </p>
                  <p className="mt-2 max-w-[36ch] leading-normal text-graphite">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
            <InstitutionalLoginForm className="mt-12" />
          </div>
        </section>
      </main>
      <footer className="border-t border-fog bg-cloud">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-graphite sm:px-6 lg:px-12">
          <span>Universidad de Chile</span>
          <span>U-Roadmaps · Cada curso, una ruta clara.</span>
        </div>
      </footer>
    </>
  );
}
