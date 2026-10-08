---
status: accepted
date: 2026-10-08
---

# La interfaz ignora prefers-reduced-motion

U-Roadmaps no adapta sus animaciones a la preferencia `prefers-reduced-motion`
del sistema operativo: las animaciones se muestran siempre, y ningún componente,
estilo ni configuración nueva (incluido el tutorial con driver.js) debe
desactivarlas o reducirlas por esa preferencia. Es una decisión explícita del
responsable del producto, no un descuido; quien lea el código no debe
"corregirlo" reintroduciendo la consulta.

## Consecuencias

- Deben eliminarse las variantes `motion-reduce:` y las consultas
  `@media (prefers-reduced-motion)` existentes en
  `src/app/_components/GlobalNavigation.tsx`,
  `src/features/academic-overview/components/AcademicOverview.tsx`,
  `src/features/roadmap/RoadmapErrorToast.tsx`,
  `src/features/roadmap/RoadmapSuccessToast.tsx`,
  `src/features/roadmap/graph/NodeActionMenu.module.css`,
  `src/features/roadmap/graph/RoadmapNode.tsx`,
  `src/features/roadmap/editor/NodeCreator.module.css`,
  `src/features/roadmap/session/RoadmapCanvasView.tsx`,
  `src/shared/ui/sheet.tsx` y `src/shared/ui/alert-dialog.tsx`, junto con la
  aserción correspondiente de `tests/features/roadmap/graph/RoadmapNode.test.tsx`.
- La incorporación de animaciones en los distintos aspectos de la aplicación se
  decidirá en sesiones de grilling dedicadas, una por aspecto, que concreten qué
  se anima y por qué dentro de los criterios de movimiento de `DESIGN.md`.
- La regla de `DESIGN.md` de no comunicar estado solo mediante movimiento sigue
  vigente.
