import { GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#1a1a1a]">
      <header className="border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#c9e0fc] p-2 text-[#024ad8]"><GraduationCap className="h-6 w-6" /></div>
            <div><h1 className="text-base font-medium tracking-tight">FCFM - Universidad de Chile</h1><p className="text-[10px] font-medium text-[#636363]">Departamento de Ciencias de la Computación</p></div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-2xl bg-[#1a1a1a] p-8 text-white sm:p-12">
          <div className="max-w-3xl space-y-4"><p className="text-sm uppercase tracking-[0.16em] text-[#8ebdce]">U-roadmaps</p><h2 className="text-[32px] font-medium leading-none tracking-tight">Rutas de aprendizaje para cursos universitarios</h2><p className="text-lg leading-relaxed text-[#c2c2c2]">Los roadmaps se identifican por ramo y período académico. La integración con U-Cursos materializará aquí los cursos que necesiten una ruta.</p></div>
        </section>
      </div>
      <footer className="border-t border-[#e8e8e8] bg-white py-6"><div className="mx-auto max-w-7xl px-4 text-xs text-[#636363] sm:px-6 lg:px-8">© 2026 Propuesta de Memoria DCC - Universidad de Chile.</div></footer>
    </main>
  );
}
