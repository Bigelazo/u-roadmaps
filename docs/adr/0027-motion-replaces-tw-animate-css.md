---
status: accepted
date: 2026-10-14
---

# Motion anima todo lo que no es un primitivo de shadcn

Las animaciones de U-Roadmaps se escriben con Motion (`motion/react`), salvo las de
los componentes primitivos de shadcn en `src/shared/ui/`, que conservan
`tw-animate-css` porque así los genera y actualiza shadcn. Motion expresa lo que las
clases de Tailwind y los `@keyframes` no expresan bien: secuencias escalonadas por
datos, trazado de aristas SVG con `pathLength`, resortes, gestos y salidas
animadas. `tw-animate-css` no se elimina: queda acotado a esos primitivos.

## Consecuencias

- Fuera de `src/shared/ui/`, ninguna animación nueva usa utilidades de
  `tw-animate-css` (`animate-in`, `fade-in`, `slide-in-*`, …) ni `@keyframes`
  propios. Las existentes se reemplazan por Motion: hoy son los menús de
  `src/features/roadmap/graph/NodeActionMenu.module.css` y
  `src/features/roadmap/editor/NodeCreator.module.css`.
- Los primitivos de shadcn mantienen sus clases `data-open:animate-in` /
  `data-closed:animate-out` y el acordeón. Un consumidor puede ajustarlas o
  anularlas con clases (por ejemplo `data-open:animate-none`), pero no reescribirlas
  con Motion; así una nueva versión de shadcn se integra sin conflictos.
- Un componente que usa Motion es un Client Component (`'use client'`).
- Motion no reduce el movimiento por defecto (`MotionConfig.reducedMotion` es
  `"never"`), coherente con ADR-0022. No debe configurarse `reducedMotion: "user"`
  ni usarse `useReducedMotion` para desactivar animaciones.
- Las transiciones CSS de un solo cambio de estado en hover, foco o selección
  (`transition-colors`, `transition-shadow`) no son coreografías y pueden seguir en
  Tailwind.
