import { notFound } from 'next/navigation';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';

export default function DevelopmentPersonasPage() {
  if (!developmentEnvironmentEnabled()) notFound();
  return (
    <main className="min-h-screen bg-[#f3f5f7] py-12 text-[#12213a]">
      <div className="mx-auto max-w-2xl px-6">
        <section className="rounded-[var(--radius-xl)] border border-[#dce1e8] bg-white p-6 sm:p-8">
          <div className="space-y-5">
            <p className="text-xs font-bold tracking-[0.1em] text-[#024ad8] uppercase">
              Entorno de desarrollo
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
              Seleccionar persona
            </h1>
            <p className="text-[#5a6474]">
              Alterna entre los casos representativos usando la barra DESARROLLO.
            </p>
            <ul className="space-y-2 text-sm">
              {developmentPersonas.map((persona) => (
                <li key={persona.id}>{persona.label}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
