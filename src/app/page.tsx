import { ArrowRight, BookOpen, ListChecks, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#12213a]">
      <div className="mx-auto max-w-[1440px] px-6 py-10 md:py-20">
        <section className="overflow-hidden rounded-[var(--radius-xl)] bg-[#12213a] p-8 text-white md:grid md:grid-cols-[minmax(0,1fr)_420px] md:gap-12 md:p-14">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-bold tracking-[0.1em] text-[#c9e0fc] uppercase">
              U-Roadmaps
            </p>
            <h1 className="font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.05em] md:text-7xl">
              Cada curso, una ruta clara.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#e5eaf2]">
              U-Roadmaps muestra cómo se conectan los contenidos de tus cursos para que puedas
              preparar cada unidad con una visión clara de sus requisitos y recursos.
            </p>
            <Link
              className={buttonVariants({ className: 'mt-8', size: 'lg' })}
              href="/api/plogin/start"
            >
              Ingresar con U-Pasaporte <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div
            aria-label="Ruta de aprendizaje de ejemplo"
            className="relative mt-10 min-h-72 md:mt-0"
          >
            <div className="absolute top-10 right-0 left-6 h-px bg-[#296ef9]" />
            <div className="absolute top-10 left-6 size-4 rounded-full border-4 border-[#12213a] bg-[#35a779]" />
            <div className="absolute top-10 left-[48%] size-4 rounded-full border-4 border-[#12213a] bg-[#c9e0fc]" />
            <div className="absolute top-10 right-0 size-4 rounded-full border-4 border-[#12213a] bg-[#c9e0fc]" />
            <div className="absolute top-20 left-0 w-44 rounded-lg border border-[#296ef9] bg-white p-4 text-[#12213a] shadow-[0_4px_10px_rgb(18_33_58_/_7%)]">
              <p className="text-xs font-bold text-[#176245]">Completado</p>
              <p className="font-heading mt-1 text-lg font-semibold">Variables</p>
            </div>
            <div className="absolute top-32 left-[42%] w-44 rounded-lg border-2 border-[#35a779] bg-[#ddf2e9] p-4 text-[#12213a]">
              <p className="text-xs font-bold text-[#176245]">Estás aquí</p>
              <p className="font-heading mt-1 text-lg font-semibold">Funciones</p>
            </div>
            <div className="absolute top-52 right-0 w-44 rounded-lg border border-[#dce1e8] bg-white p-4 text-[#12213a]">
              <p className="text-xs font-bold text-[#5a6474]">Siguiente</p>
              <p className="font-heading mt-1 text-lg font-semibold">Estructuras</p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <p className="text-xs font-bold tracking-[0.1em] text-[#024ad8] uppercase">
            Una ruta para cada curso
          </p>
          <h2 className="font-heading mt-2 text-4xl font-semibold tracking-[-0.04em]">
            Lo importante, en el orden que importa.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: MapIcon,
                title: 'Explora el mapa del curso',
                description:
                  'Visualiza unidades, evaluaciones y materiales complementarios en una sola ruta.',
              },
              {
                icon: ListChecks,
                title: 'Sigue tu avance',
                description:
                  'Identifica qué contenidos ya completaste y cuáles debes preparar antes de continuar.',
              },
              {
                icon: BookOpen,
                title: 'Encuentra recursos a tiempo',
                description:
                  'Accede a lecturas, archivos y enlaces asociados directamente a cada tema.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <article
                className="min-h-52 rounded-[var(--radius-xl)] border border-[#dce1e8] bg-white p-6"
                key={title}
              >
                <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-[#c9e0fc] text-[#024ad8]">
                  <Icon aria-hidden="true" size={23} />
                </div>
                <h3 className="font-heading mt-6 text-2xl font-semibold tracking-[-0.02em]">
                  {title}
                </h3>
                <p className="mt-2 leading-relaxed text-[#5a6474]">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
      <footer className="border-t border-[#dce1e8] bg-white">
        <div className="mx-auto max-w-[1440px] px-6 py-5 text-sm text-[#5a6474]">
          Universidad de Chile
        </div>
      </footer>
    </main>
  );
}
