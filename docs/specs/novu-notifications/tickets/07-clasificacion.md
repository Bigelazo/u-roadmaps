# 07 — Comunicar renombres de Tipos de nodo utilizados

Issue: [#146](https://github.com/Bigelazo/u-roadmaps/issues/146). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Las Participaciones entienden un cambio de clasificación cuando se renombra un Tipo utilizado por Nodos visibles, sin recibir avisos por cambios exclusivamente visuales.

## Acceptance criteria

- [ ] Un renombre confirmado de Tipo con al menos un Nodo visible emite un único aviso general de Cambio de clasificación a Participaciones activas salvo autora.
- [ ] Crear/eliminar un Tipo sin uso, renombre sin cambio efectivo y cambio solo de icono/color no emiten. Cambiar el Tipo asignado a un Nodo conserva la variante Nodo actualizado del corte 2.
- [ ] El mensaje conserva contexto del renombre, abre Roadmap y se reconoce al entrar sin borrar avisos de Nodos accesibles no abiertos.
- [ ] Pruebas de aceptación cubren uso en Nodos visibles/ocultos, varios Nodos del mismo Tipo, ausencia de uso, cambios de apariencia y diferencia entre renombrar Tipo y reasignarlo.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/141
