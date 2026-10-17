---
status: accepted
date: 2026-10-05
---

# La concurrencia de la edición docente depende del tiempo real del Roadmap

Las ediciones de título, descripción y tipo de un Nodo no tienen verificación de
concurrencia en el servidor: **gana la última escritura** (`editor.ts` solo
responde 409 ante fallos de serialización). Lo que hoy evita que un docente pise
sin saberlo el cambio de otro es el cliente: el Roadmap docente se recarga en vivo
por SSE y conserva el borrador local avisando *«cambió mientras editabas»*
(`roadmap-realtime-prototype.spec.ts`). Eliminar, ocultar y bloquear sí están
protegidos en el servidor mediante `previewVersion`.

Se decide **mantener el tiempo real del Roadmap para el equipo docente** como la
protección de estas ediciones, y no añadir por ahora una verificación en el
servidor. Quien retire o limite la recarga en vivo del Roadmap docente debe
reemplazar antes esa protección.

Surgió en la sesión de [ADR-0014](0014-target-based-notice-grouping.md), al
evaluar quitar el tiempo real del Roadmap a todos. Es independiente del sistema
de avisos.

## Alternativas consideradas

- **Quitar el tiempo real y aceptar que gane la última escritura:** las pérdidas
  silenciosas serían frecuentes porque los docentes trabajarían con vistas
  desactualizadas.
- **Quitar el tiempo real y verificar en el servidor:** al guardar, el cliente
  envía el valor que tenía cargado y el servidor responde 409 si cambió, pidiendo
  volver a entrar. Viable, pero se prefirió no modificar la gestión del Roadmap
  docente en esta iteración.

## Corrección — 2026-10-17: qué protege `previewVersion` en el servidor

La afirmación de que ocultar y bloquear estaban protegidos por `previewVersion` era
inexacta: el servidor solo comprobaba la versión al eliminar y al desbloquear un Nodo.
Desde #276, eliminar un Nodo, desbloquearlo, ocultarlo, aplicar un BLOCK y crear una
Dependency revalidan en el servidor la versión del impacto de su previsualización y
responden 409 si cambió (`NODE_DELETE_PREVIEW_STALE`, `TEACHER_BLOCK_PREVIEW_STALE`,
`NODE_VISIBILITY_PREVIEW_STALE`, `DEPENDENCY_PREVIEW_STALE`). La versión es opcional
para todas salvo el desbloqueo hasta que el cliente la envíe siempre. Las ediciones de
título, descripción y tipo siguen dependiendo del tiempo real, como decide este ADR.

## Actualización — 2026-10-17: la versión es obligatoria

Desde #281, como el canvas ya envía la versión en toda Acción confirmada con
previsualización, el servidor la exige para eliminar, ocultar, desbloquear y bloquear un
Nodo y para crear una Dependency. Una confirmación sin versión se rechaza como una
obsoleta: 409 con el mismo código. Mostrar un Nodo no tiene Impacto del cambio y no la
necesita. La regla vive en la decisión de dominio que comparten el servidor y el Mapa de
práctica ([ADR-0028](0028-roadmap-editing-rules-are-shared-domain-decisions.md)): ninguna
escritura interna del servidor (la creación o copia de un Roadmap, las fixtures de
desarrollo, el Scheduled unlock release) pasa por estos comandos, así que ninguna tiene que
inventar una versión.
