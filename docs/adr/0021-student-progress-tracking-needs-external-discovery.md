---
status: accepted
date: 2026-10-08
---

# Definir el seguimiento de estudiantes antes de implementarlo

**Student progress tracking** está definido en [CONTEXT.md](../../CONTEXT.md),
pero todavía no existe una vista ni una API docente de seguimiento. Al implementar
[#191](https://github.com/Bigelazo/u-roadmaps/issues/191), esa especificación asumía
que la feature ya existía. Se acordó limitar el issue a corregir cargos, permisos
y la representación de las Participations, dejando el seguimiento para trabajo
posterior.

Se decide conservar este trabajo como una línea pendiente de definición para
futuras sesiones de **grilling**, precedidas o acompañadas por trabajo externo.
Antes de redactar un issue de implementación, hay que contrastar las necesidades
con usuarios docentes y verificar qué información institucional puede obtenerse.
La decisión aceptada es este proceso de definición; el alcance, las métricas y la
solución técnica del seguimiento siguen abiertos.

## Trabajo externo y preguntas para grilling

- **Uso docente.** Contrastar con profesores y ayudantes qué decisiones tomarían
  con el seguimiento, qué información necesitan y cómo trabajan entre Secciones.
- **Fuentes institucionales.** Verificar con los responsables de U-Campus qué
  interfaces, permisos y datos reales permiten obtener participantes, Secciones,
  cargos y actividad de la Participation; cómo se reconoce una respuesta completa
  y cómo se comunican retiros o cambios. La sincronización personal de quien entra
  a U-Roadmaps no garantiza un listado completo de estudiantes del Curso.
- **Sincronización de participantes.** Definir cuándo se obtiene y actualiza ese
  listado, cómo interviene el profesor de cátedra y qué ocurre con datos parciales,
  fallos o estudiantes que nunca han ingresado. La acción explícita de **Roster
  synchronization** todavía no existe.
- **Ingreso a la plataforma.** Acordar qué hecho se registra y cómo se vincula a la
  Participation. Según el glosario, **Platform entry** corresponde a un login VTI
  exitoso después de incorporarse al Curso; importar participantes o abrir un
  Roadmap son hechos distintos. Verificar su viabilidad con la integración real.
- **Métrica de progreso.** Precisar qué Completions se resumen, qué Nodos forman el
  denominador y cómo afectan los Nodos ocultos, los bloqueos, las ediciones del
  Roadmap, los retiros y el cierre del Curso. No interpretar Completion como nota
  ni como aprendizaje demostrado sin acordarlo con los usuarios docentes.
- **Acceso y presentación.** Confirmar las necesidades de consulta entre Secciones,
  el tratamiento de estudiantes inactivos y observadores, y los límites de acceso
  y conservación de identidad, actividad y progreso. El dominio vigente otorga
  consulta de todas las Secciones a todo el equipo docente; cualquier cambio de
  esa regla requerirá una decisión explícita.

## Consecuencias

- Este ADR es el punto de partida de futuras sesiones de grilling. Las respuestas
  y evidencias externas deben permitir acordar el alcance y luego redactar uno o
  más issues implementables con criterios de aceptación observables.
- [#187](https://github.com/Bigelazo/u-roadmaps/issues/187) y
  [ADR-0017](0017-persist-institutional-course-position.md) completan la persistencia
  de cargos y son una base para los permisos; por sí solos no resuelven el listado
  institucional, las Secciones ni el registro de ingreso.
- La futura vista deberá distinguir las Participations estudiantiles del equipo
  docente. Las Completions antiguas de una persona corregida a docente y las
  **Simulated completions** de **Canvas preview** no representan progreso de
  estudiantes.
- [#10](https://github.com/Bigelazo/u-roadmaps/issues/10) es un antecedente cerrado de
  definición de requisitos de progreso; su cierre no acredita la implementación
  de Student progress tracking.
