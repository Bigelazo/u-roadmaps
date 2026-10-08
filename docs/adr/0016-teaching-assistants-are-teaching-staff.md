---
status: accepted
date: 2026-10-07
---

# Los ayudantes son equipo docente

El modelo de dominio define a los ayudantes como **equipo docente**: editan el
Roadmap compartido, ven la información de ingreso y Completions de todas las
secciones y consultan el **Roadmap version history**. El código lo contradice:
`roadmapEditingPositions` en `src/features/roadmap/application/academic-participation.ts`
omite `TEACHING_ASSISTANT`, por lo que `academicRole` materializa su Participation
como `STUDENT`, y `tests/features/roadmap/application/academic-participation.test.ts`
afirma ese comportamiento. Es un defecto grave, no una restricción deliberada: la
corrección debe derivar el rol docente de todo cargo docente, aplicarlo en el
servidor y reemplazar la prueba que fija el rol incorrecto.

## Consecuencias

- Las Participations de ayudantes guardadas como `STUDENT` deben corregirse en su
  siguiente sincronización, y los avisos o Completions que acumularon como
  estudiantes deben revisarse en vez de conservarse en silencio.
- El mismo archivo contradice al dominio en la creación del Roadmap:
  `isCourseLeadPosition` permite crear al profesor coordinador, mientras el dominio
  reserva la creación (y con ella la **Roadmap copy**) exclusivamente al profesor de
  cátedra. Ambas correcciones pertenecen al mismo cambio. La causa de fondo se
  aborda en [ADR-0017](0017-persist-institutional-course-position.md).
