# 04 — Comunicar publicación, retiro y eliminación con destinos seguros

Issue: [#143](https://github.com/Bigelazo/u-roadmaps/issues/143). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

La persona comprende por qué un Nodo aparece o desaparece y puede revisar sus avisos incluso después de que el Nodo fue retirado o eliminado. Los avisos previos de Cursos sin acceso conservan una salida comprensible al Resumen académico.

## Acceptance criteria

- [ ] Publicar emite Nodo disponible sin revelar existencia oculta previa; ocultar un Nodo visible emite Nodo retirado; eliminar uno visible emite Nodo eliminado aunque estuviera bloqueado.
- [ ] Crear/editar/eliminar Nodos que permanecen ocultos no notifica. Las escrituras de Dependencias, Recursos, archivos y Completaciones en cascada no producen avisos separados.
- [ ] El aviso conserva el título anterior y, para eliminación, el Tipo anterior; la navegación valida el estado actual y degrada al Roadmap cuando el Nodo no puede abrirse.
- [ ] Entrar al Roadmap reconoce avisos de Nodos ocultos, eliminados o inaccesibles por bloqueo, preservando avisos de Nodos accesibles no abiertos; no muestra indicadores de Nodos ocultos al alumnado.
- [ ] La audiencia se calcula con estado anterior/posterior capturado en la operación confirmada, conservando autora excluida y actividad actual.
- [ ] Nodos supervivientes cuyo acceso cambió por retirar el Nodo y sus Dependencias conservan avisos individuales de disponibilidad/bloqueo; se notifican efectos de producto sin duplicar escrituras en cascada. Este corte incorpora la comparación de acceso mínima que necesita, sin depender del corte de acciones explícitas de bloqueo.
- [ ] Si la Participación perdió acceso al Curso o el Roadmap ya no existe, seleccionar el aviso lleva al Resumen académico, explica la alternativa y reconoce solo ese aviso al llegar, sin abrir diálogo del Roadmap.
- [ ] La pérdida de acceso no elimina avisos anteriores e impide triggers nuevos. Reactivación/incorporación no produce backfill; no se promete atomicidad con workflows ya aceptados en Novu.
- [ ] Pruebas de aceptación incluyen pérdida de acceso, títulos conservados, publicación/ocultamiento, eliminación de Nodo bloqueado, cascadas y destinos que cambian entre recepción y navegación.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/141
