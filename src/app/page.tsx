import React from 'react';
import RoadmapCanvas from '@/components/RoadmapCanvas';
import { BookOpen, GraduationCap, Layers, Compass, HelpCircle } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      {/* Cabecera / Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 tracking-tight">FCFM - Universidad de Chile</h1>
              <p className="text-[10px] text-slate-400 font-medium">Departamento de Ciencias de la Computación</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
              Docker Dev Env
            </span>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Presentación del Proyecto de Memoria */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="space-y-3 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
              Propuesta de Memoria de Título
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Desarrollo de Roadmap Interactivo para Cursos Universitarios
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Este prototipo implementa la <span className="text-slate-200 font-semibold">"Fase de Arquitectura y Dockerización"</span> contemplada en la propuesta de memoria de <span className="text-blue-400">Daniel Ignacio Ramírez López</span>, bajo la guía del profesor <span className="text-slate-200">Matías Toro Ipinza</span> (2026).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto z-10">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Modalidad</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">Memoria</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Institución</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">DCC U. de Chile</div>
            </div>
          </div>
        </div>

        {/* Sección del Lienzo React Flow */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-bold text-slate-200">Lienzo Interactivo de Mapeo Curricular</h3>
            </div>
          </div>
          <RoadmapCanvas />
        </div>

        {/* Pilares / Características */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/30 flex gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 h-fit">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200 text-sm">Visualización en Grafos</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Supera el modelo tradicional de listas estáticas de U-Cursos. Organiza contenidos y ramos interactivos mediante nodos (unidades) y aristas (relaciones o requisitos).
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/30 flex gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 h-fit">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200 text-sm">Persistencia Relacional</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                El backend en Node.js/Next.js persiste la estructura del roadmap en una base de datos relacional (PostgreSQL), permitiendo a los profesores crear material duradero semestre a semestre.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/30 flex gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 h-fit">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200 text-sm">¿Cómo probar la herramienta?</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Arrastra los nodos para reordenarlos. Haz clic y arrastra desde los círculos de conexión (handles) para enlazar cursos. Usa el panel izquierdo para agregar nuevos hitos y guardarlos.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Pie de Página / Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div>
            © 2026 Propuesta de Memoria DCC - Universidad de Chile.
          </div>
          <div>
            Contenedores Docker configurados: <code className="text-blue-400 font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/30">postgres:15-alpine</code> + <code className="text-blue-400 font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/30">node:18-alpine (Next.js)</code>
          </div>
        </div>
      </footer>
    </main>
  );
}
