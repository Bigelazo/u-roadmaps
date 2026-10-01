# 01 — Recibir en el Inbox la disponibilidad de un Roadmap

Issue: [#140](https://github.com/Bigelazo/u-roadmaps/issues/140). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Una Participación activa recibe en su Inbox seguro el aviso de creación de un Roadmap y puede navegar al Curso, abrir el diálogo y reconocerlo al entrar. Este primer recorrido entrega la configuración, identidad, Adapter de pruebas y prefactorización mínima como parte de una función demostrable.

## Acceptance criteria

- [ ] Crear un Roadmap emite un aviso después del commit a las Participaciones activas materializadas del Curso, excepto la autora; no emite por conflicto, validación fallida o mera materialización del Curso.
- [ ] El Module del Roadmap entrega un descriptor confirmado independiente de Novu; el Module de notificaciones usa su Interface pública, el SDK de servidor y un Adapter sustituible en la Seam de transporte.
- [ ] Los suscriptores elegibles existen aunque nunca hayan abierto Inbox; se usan UUID canónicos y claves estables por intento de envío. Se comprueba actividad antes de cada trigger y se limita el envío según el presupuesto de la especificación.
- [ ] Una caída de Novu conserva la mutación y su respuesta correcta; el envío acotado, los reintentos idempotentes y el logging mínimo no exponen secretos.
- [ ] La campana autenticada muestra lista paginada, carga, vacío y error recuperable; el contador usa avisos no leídos. El HMAC se genera para el Usuario autenticado en servidor y nunca se entrega la Secret Key al navegador.
- [ ] Seleccionar una fila navega primero al Roadmap y abre allí el diálogo con Curso, autor y fecha/hora efectiva local; entrar reconoce ese aviso general, mientras mostrar la fila solo lo marca visto.
- [ ] La UI funciona en móvil y teclado, conserva foco y no ofrece acciones globales de read/seen. Logout o cambio de Usuario desmontan el proveedor y descartan sus datos.
- [ ] Quedan fijadas versiones compatibles, región/environment configurables, contratos de datos y manifiesto reproducible de los cinco workflows; este recorrido usa disponibilidad inmediata. La integración permanece deshabilitada en producción hasta el corte 10.
- [ ] Pruebas de aceptación sobre las APIs y PostgreSQL existente con Adapter determinista demuestran acción → commit → audiencia → Inbox → navegación → reconocimiento, incluyendo HMAC/aislamiento y fallo de transporte. La evidencia de Novu real se registra por separado.

## Blocked by

None — can start immediately.
