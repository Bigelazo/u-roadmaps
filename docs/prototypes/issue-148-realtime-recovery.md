# Roadmap abierto y recuperación (#148)

El proveedor Novu existente escucha `notifications.notification_received` (`event.result.data`) y valida clase e Identificador de curso antes de emitir la señal de invalidación. Se reutiliza su cliente/socket. Las sesiones actuales estudiantiles (incluido Rol de participación observador) y docentes recargan únicamente su Curso/Período por HTTP `no-store`; nunca dibujan el payload. El contador de solicitudes y la identidad de sesión descartan respuestas anteriores y de sesiones terminadas.

Retornar a primer plano (focus/visibility), recuperar conexión (`online` o `socket.connect.resolved`) y reintentar provocan nuevas lecturas de proyección, feed y conteos. No hay polling. Estas lecturas no abren de nuevo el Roadmap ni el Nodo y no llaman read/seen. Una falla transitoria conserva la proyección; HTTP 401/403/404 autoritativo retira contenido y redirige al Resumen académico con explicación. La Previsualización del canvas mantiene su proyección y Completaciones independientes; se vuelve a consultar su endpoint al actualizar el Roadmap docente.

Un Nodo accesible conserva identidad y detalle actualizado; bloqueo cierra detalle manteniendo selección. Ocultamiento/eliminación retira selección, devuelve foco y explica el cambio. El editor conserva borradores y señala cambios de contenido, acceso o Recursos mientras hay datos locales. No permite persistir hasta elegir explícitamente conservar el borrador sobre la versión actual. Un Nodo eliminado conserva el borrador local visible sin permitir guardarlo. Esto protege cambios recibidos durante la sesión; no ofrece bloqueo optimista transaccional contra una edición concurrente que aún no llegó.

## Evidencia y ensayo real

`tests/e2e/roadmap-realtime-prototype.spec.ts` amplía el experimento #130 con dos sesiones docentes, borrador incompatible, pérdida/reintento de lectura y recuperación sin aviso. Conserva edición, bloqueo, ocultamiento/eliminación, selección y foco. Las pruebas de componentes verifican el callback público del SDK, filtros de identidad/clase, ausencia de reconocimiento y recuperación docente.

`tests/e2e/roadmap-novu-websocket.spec.ts` es un ensayo explícito opt-in: observa un frame WebSocket real `notification_received`, una lectura HTTP autorizada posterior a una mutación docente y el indicador pendiente del Nodo nuevo. No inyecta una señal local. Requiere los cinco workflows publicados en un environment de pruebas, identidades de fixture y configuración Novu habilitada (`NOVU_NOTIFICATIONS_ENABLED=true`, `NOVU_PRODUCTION_APPROVED=true` para el servidor E2E compilado, `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER`, `NOVU_SECRET_KEY`, `NOVU_WORKFLOW_*` y región `NOVU_SERVER_URL`/`NEXT_PUBLIC_NOVU_API_URL`/`NEXT_PUBLIC_NOVU_SOCKET_URL` correspondiente). Ejecutar:

```sh
RUN_NOVU_REALTIME=1 pnpm exec playwright test tests/e2e/roadmap-novu-websocket.spec.ts --project=chrome
```

El ensayo está omitido en la suite habitual. Este checkout no proporciona credenciales Novu: **la entrega real por WebSocket no se ha certificado**. La prueba del callback con transporte determinista no demuestra entrega real. Sin una señal, no se garantiza actualización inmediata; primer plano, reconexión o reintento recuperan el estado autorizado mediante una lectura nueva. No hay entrega durable ni garantía de latencia.
