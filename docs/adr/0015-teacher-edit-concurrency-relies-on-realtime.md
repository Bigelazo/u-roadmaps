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
