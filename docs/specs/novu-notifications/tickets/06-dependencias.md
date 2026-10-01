# 06 — Comunicar cambios de ruta y sus efectos de acceso

Issue: [#145](https://github.com/Bigelazo/u-roadmaps/issues/145). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Una Participación entiende qué prerrequisito se agregó o quitó y recibe además avisos separados por los Nodos cuyo acceso cambió como consecuencia.

## Acceptance criteria

- [ ] Agregar/quitar una Dependencia entre Nodos visibles confirma primero la acción y emite un aviso general con «X ahora requiere Y» o «X ya no requiere Y».
- [ ] La acción reutiliza el cálculo de impacto para emitir Nodo bloqueado/disponible por cada Nodo y Participación cuyo acceso cambió, incluida propagación transitiva.
- [ ] El aviso de ruta abre Roadmap y se reconoce al entrar; avisos de Nodos accesibles conservan su reconocimiento por apertura individual.
- [ ] Autora, inactivas y otros Cursos no reciben. Dependencias de Nodos ocultos, validaciones fallidas, ciclos rechazados y escrituras en cascada de otras acciones no duplican avisos.
- [ ] Pruebas de aceptación verifican mensaje de ruta y efectos por Nodo, acceso divergente según Completaciones, ausencia de falsos desbloqueos y conservación de indicadores de otros Nodos.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/144
