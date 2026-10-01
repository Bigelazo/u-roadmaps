# 11 — Reserva futura: aviso previo al congelamiento por Inbox y correo

Issue: [#150](https://github.com/Bigelazo/u-roadmaps/issues/150). Publicado como seguimiento futuro con `enhancement`, fuera del MVP y sin `ready-for-agent`.

Seguimiento futuro fuera del MVP; pendiente de decisiones y del ciclo de cierre, sin etiqueta `ready-for-agent`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139), apartado Further Notes.

## What to build

Una Participación activa de un Curso con Roadmap recibe un aviso previo al congelamiento basado en la fecha académica verificada, por Inbox y correo, con navegación autorizada. Se incluyen todas las Participaciones activas, sin exclusión de una supuesta persona autora. El workflow se implementa únicamente después de disponer del ciclo de cierre y sus decisiones temporales.

## Acceptance criteria

- [ ] Acordar anticipación, repetición, hora/zona del corte, reprogramación/cancelación, idempotencia y tratamiento de Roadmaps creados después de programar. Las resoluciones cerradas no proporcionan esos valores.
- [ ] Referenciar evidencia del ciclo de cierre: ejecutor, eliminación atómica de Bloqueos docentes, congelamiento persistido y protección temporal de todas las mutaciones editoriales, conforme ADR-0001 y al ciclo propuesto en ADR-0007.
- [ ] Elegir ejecución posterior a sincronización o consulta periódica según esas decisiones; no derivar fechas por suposición ni tratar una UI histórica como evidencia de congelamiento real.
- [ ] Antes de implementar, convertir este seguimiento en especificación/tickets ejecutables con contrato de Inbox/correo, proveedor de correo, audiencia, fecha, contenido, destino y pruebas de corrección/cancelación.
- [ ] Mantener este seguimiento fuera de la habilitación y dependencias del MVP.

## Blocked by

- Decisiones temporales/de producto todavía no tomadas; no se finge que #134 eliminado las resolvió.
- Implementación y evidencia del ciclo de cierre académico: #133 es investigación cerrada, no un bloqueador de implementación completado. Debe vincularse el issue de cierre real al crearlo o identificarlo.
- Reutiliza las capacidades de notificaciones del MVP cuando se implemente, sin bloquear ninguno de los cortes 01–10.
