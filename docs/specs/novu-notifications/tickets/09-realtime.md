# 09 — Actualizar el Roadmap abierto y recuperar cambios perdidos

Issue: [#148](https://github.com/Bigelazo/u-roadmaps/issues/148). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Una Participación con su Roadmap abierto recibe contenido autorizado vigente, conserva una selección coherente y recupera el estado al volver a su pestaña o reconectar, sin reconocer avisos nuevos automáticamente.

## Acceptance criteria

- [ ] El callback real notifications.notification_received valida Identificador de curso/clase y conecta con la señal de invalidación existente; solo el Curso/Período activo se recarga por HTTP sin caché.
- [ ] Se cubren sesiones actuales de estudiantes, observadores y docentes destinatarios; no se dibuja contenido desde payload ni se reconoce por llegada, refetch o reconexión.
- [ ] El Nodo accesible mantiene identidad, selección y detalle actualizado. Bloqueo cierra detalle; ocultamiento/eliminación limpia selección, devuelve foco y explica el cambio.
- [ ] Respuestas antiguas, señales de otros Cursos y sesiones terminadas no reemplazan estado actual. Duplicados no alteran reconocimiento.
- [ ] Volver a primer plano, recuperar conexión y reintento explícito recargan proyección, feed y conteos sin simular nueva apertura y sin polling permanente.
- [ ] Un fallo transitorio conserva última proyección con error recuperable; pérdida autoritativa de acceso retira contenido y lleva al Resumen académico.
- [ ] Una sesión docente con borrador conserva datos locales y señala cambios incompatibles antes de guardar; no se persiste ni descarta el borrador silenciosamente. Previsualización conserva identidad separada.
- [ ] Se extiende la evidencia del prototipo con E2E determinista de dos sesiones y prueba explícita del WebSocket real de Novu. Se documenta que ausencia de señal no da actualización inmediata garantizada.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/141
