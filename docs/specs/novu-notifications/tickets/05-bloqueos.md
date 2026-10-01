# 05 — Comunicar bloqueos y desbloqueos por Participación

Issue: [#144](https://github.com/Bigelazo/u-roadmaps/issues/144). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Cada Participación conoce qué Nodos cambiaron efectivamente de acceso cuando el equipo docente bloquea o desbloquea un Nodo o una rama, y reconoce cada aviso en su contexto apropiado.

## Acceptance criteria

- [ ] Se comparan proyecciones de acceso anterior/posterior usando las reglas vigentes de Bloqueo docente, prerrequisitos, Desbloqueo de nodo y Desbloqueo de rama; se respeta ADR-0010.
- [ ] Cada Nodo directa o transitivamente afectado genera su propio aviso por Participación: accesible → bloqueado o bloqueado → accesible. La audiencia docente compara su acceso sin Completaciones.
- [ ] Una causa distinta que mantiene bloqueado el Nodo no emite; un desbloqueo que no devuelve acceso individual no anuncia disponibilidad.
- [ ] Recuperar acceso solo informa disponibilidad, sin reenviar ni revelar ediciones internas hechas mientras el Nodo era inaccesible.
- [ ] Entrar al Roadmap reconoce avisos de Nodos cuyo detalle está bloqueado; avisos de Nodos accesibles permanecen hasta abrirlos. El diálogo nunca muestra detalles protegidos.
- [ ] La captura de efectos sucede con la acción confirmada; cancelaciones y previsualizaciones no entregan; escrituras internas no duplican los avisos.
- [ ] El cálculo de impacto queda reutilizable dentro del Module del Roadmap para Dependencias, sin exponer Prisma/Novu a la UI.
- [ ] Pruebas de aceptación cubren cadena y rama, prerrequisito externo, completaciones retenidas, acceso distinto entre dos estudiantes y docente, autora e inactivas.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/141
